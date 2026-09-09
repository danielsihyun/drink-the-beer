import SwiftUI

/// Uses the server-authoritative duel state machine. The server decides
/// friendship, blocking, scoring, and whether each command is legal.
public struct DuelScreen: View {
  private let client: APIClient?
  @State private var duels: [Duel] = []
  @State private var friends: [FriendListEntry] = []
  @State private var viewer: UserProfile?
  @State private var error: String?
  @State private var loading = false
  @State private var showingChallenge = false
  public init(client: APIClient? = nil) { self.client = client }
  public var body: some View {
    List {
      if let error { Section { Text(error).foregroundStyle(.red) } }
      if loading && duels.isEmpty { Section { ProgressView("Loading duels…") } }
      if !loading && duels.isEmpty { ContentUnavailableView("No duels yet", systemImage: "figure.fencing", description: Text("Challenge an accepted friend to get started.")) }
      section("Incoming challenges", duels.filter { $0.status == "pending" && $0.challengedId == viewer?.id })
      section("Sent challenges", duels.filter { $0.status == "pending" && $0.challengerId == viewer?.id })
      section("Active duels", duels.filter { $0.status == "active" })
      section("Completed", duels.filter { $0.status == "completed" })
      section("Past challenges", duels.filter { ["declined", "cancelled"].contains($0.status) })
    }
    .navigationTitle("Duels")
    .toolbar {
      Button { showingChallenge = true } label: { Image(systemName: "plus") }.disabled(friends.isEmpty)
      Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise") }.disabled(loading)
    }
    .sheet(isPresented: $showingChallenge) { ChallengeDuelSheet(friends: friends) { friend, category, duration in
      await send(DuelCommand(action: "challenge", duelId: nil, targetId: friend.id, category: category, duration: duration))
    } }
    .task { await load() }
  }
  @ViewBuilder private func section(_ title: String, _ values: [Duel]) -> some View {
    if !values.isEmpty { Section(title) { ForEach(values) { duel in NavigationLink { DuelDetailScreen(duel: duel, viewerID: viewer?.id, opponent: opponent(for: duel), command: send) } label: { DuelRow(duel: duel, viewerID: viewer?.id, opponent: opponent(for: duel)) } } } }
  }
  private func opponent(for duel: Duel) -> FriendListEntry? {
    guard let viewer else { return nil }
    let id = duel.challengerId == viewer.id ? duel.challengedId : duel.challengerId
    return friends.first { $0.id == id }
  }
  private func load() async {
    guard let client else { error = "Set the API base URL in Profile."; return }
    loading = true; defer { loading = false }
    do { async let d = client.duels(); async let f = client.friends(); async let p = client.myProfile(); duels = try await d.sorted { ($0.endsAt ?? .distantPast) > ($1.endsAt ?? .distantPast) }; friends = try await f.friends; viewer = try await p; error = nil } catch { self.error = error.localizedDescription }
  }
  private func send(_ command: DuelCommand) async { guard let client else { return }; do { _ = try await client.duel(command); await load() } catch { self.error = error.localizedDescription } }
}

private struct DuelRow: View {
  let duel: Duel; let viewerID: UUID?; let opponent: FriendListEntry?
  var body: some View { HStack(spacing: 12) {
    Image(systemName: duel.category == "drink_types" ? "square.grid.2x2" : "wineglass").foregroundStyle(.orange).frame(width: 25)
    VStack(alignment: .leading, spacing: 3) { Text(opponent?.displayName ?? opponent?.username ?? "Duel opponent").font(.headline); Text("\(label) · \(duel.duration)").font(.caption).foregroundStyle(.secondary); Text(statusText).font(.caption.weight(.medium)).foregroundStyle(statusColor) }
    Spacer(); if duel.status == "completed", let mine = myScore, let theirs = theirScore { Text("\(mine)–\(theirs)").font(.title3.monospacedDigit()) }
  } }
  private var label: String { duel.category == "drink_types" ? "Drink types" : "Total drinks" }
  private var myScore: Int? { duel.challengerId == viewerID ? duel.challengerScore : duel.challengedScore }
  private var theirScore: Int? { duel.challengerId == viewerID ? duel.challengedScore : duel.challengerScore }
  private var statusText: String { if duel.status == "active", let end = duel.endsAt { return end > .now ? "Ends \(end.formatted(.relative(presentation: .named)))" : "Ready to complete" }; if duel.status == "completed" { if duel.winnerId == nil { return "Draw" }; return duel.winnerId == viewerID ? "You won" : "You lost" }; return duel.status.capitalized }
  private var statusColor: Color { duel.status == "completed" && duel.winnerId == viewerID ? .green : (duel.status == "pending" ? .orange : .secondary) }
}

private struct DuelDetailScreen: View {
  let duel: Duel; let viewerID: UUID?; let opponent: FriendListEntry?; let command: (DuelCommand) async -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var working = false
  var body: some View { List {
    Section("Opponent") { HStack { DuelAvatar(name: opponent?.displayName ?? opponent?.username ?? "Opponent"); VStack(alignment: .leading) { Text(opponent?.displayName ?? opponent?.username ?? "Duel opponent"); if let username = opponent?.username { Text("@\(username)").font(.caption).foregroundStyle(.secondary) } } } }
    Section("Challenge") { LabeledContent("Metric", value: duel.category == "drink_types" ? "Unique drink types" : "Total drinks"); LabeledContent("Duration", value: duel.duration); if let start = duel.startsAt { LabeledContent("Started") { Text(start, style: .date) } }; if let end = duel.endsAt { LabeledContent("Ends") { Text(end, style: .date) } } }
    if duel.status == "active" { Section("Score") { scoreRow; if let end = duel.endsAt { Text(end > .now ? "Results are calculated after the duel ends." : "This duel is ready to complete.").font(.caption).foregroundStyle(.secondary) } } }
    if duel.status == "completed" { Section("Result") { scoreRow; Text(result).font(.headline) } }
    Section { actions }
  }.navigationTitle("Duel").overlay { if working { ProgressView() } } }
  private var scoreRow: some View { HStack { Text("You"); Spacer(); Text("\(myScore ?? 0) – \(theirScore ?? 0)").font(.title2.monospacedDigit()); Spacer(); Text(opponent?.displayName ?? "Opponent") } }
  private var myScore: Int? { duel.challengerId == viewerID ? duel.challengerScore : duel.challengedScore }
  private var theirScore: Int? { duel.challengerId == viewerID ? duel.challengedScore : duel.challengerScore }
  private var result: String { duel.winnerId == nil ? "It ended in a draw." : duel.winnerId == viewerID ? "You won this duel." : "Your opponent won this duel." }
  @ViewBuilder private var actions: some View {
    if duel.status == "pending" && duel.challengedId == viewerID { Button("Accept challenge") { run("accept") }.buttonStyle(.borderedProminent); Button("Decline", role: .destructive) { run("decline") } }
    else if duel.status == "pending" && duel.challengerId == viewerID { Button("Cancel challenge", role: .destructive) { run("cancel") } }
    else if duel.status == "active", (duel.endsAt ?? .distantFuture) <= .now { Button("Calculate result") { run("complete") }.buttonStyle(.borderedProminent) }
    else if duel.status == "completed", let opponent { Button("Rematch") { rematch(opponent) }.buttonStyle(.borderedProminent) }
  }
  private func run(_ action: String) { Task { working = true; await command(DuelCommand(action: action, duelId: duel.id, targetId: nil, category: nil, duration: nil)); working = false; if action != "complete" { dismiss() } } }
  private func rematch(_ opponent: FriendListEntry) { Task { working = true; await command(DuelCommand(action: "challenge", duelId: nil, targetId: opponent.id, category: duel.category, duration: duel.duration)); working = false; dismiss() } }
}

private struct ChallengeDuelSheet: View {
  let friends: [FriendListEntry]; let submit: (FriendListEntry, String, String) async -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var friendID: UUID?; @State private var category = "total_drinks"; @State private var duration = "1D"; @State private var submitting = false
  var body: some View { NavigationStack { Form {
    Section("Opponent") { Picker("Friend", selection: $friendID) { Text("Choose a friend").tag(UUID?.none); ForEach(friends) { person in Text(person.displayName ?? person.username).tag(Optional(person.id)) } } }
    Section("Challenge") { Picker("Metric", selection: $category) { Text("Total drinks").tag("total_drinks"); Text("Unique drink types").tag("drink_types") }.pickerStyle(.segmented); Picker("Duration", selection: $duration) { Text("1 day").tag("1D"); Text("3 days").tag("3D"); Text("1 week").tag("1W") }.pickerStyle(.segmented) }
  }.navigationTitle("New duel").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Challenge") { guard let friendID, let friend=friends.first(where:{$0.id == friendID}) else { return }; Task { submitting = true; await submit(friend, category, duration); submitting = false; dismiss() } }.disabled(friendID == nil || submitting) } }.overlay { if submitting { ProgressView() } } } }
}

private struct DuelAvatar: View { let name: String; var body: some View { Text(String(name.prefix(1)).uppercased()).font(.headline).frame(width: 42, height: 42).background(.orange.opacity(0.2), in: Circle()) } }
