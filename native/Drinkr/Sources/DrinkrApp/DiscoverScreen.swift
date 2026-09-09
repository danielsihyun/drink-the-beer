#if canImport(SwiftUI)
import SwiftUI

/// Private, authenticated discovery. Results are never cached in shared storage.
public struct DiscoverScreen: View {
  @AppStorage("drinkr.apiURL") private var apiURL = ""
  @State private var query = ""
  @State private var drinks: [DrinkCatalogItem] = []
  @State private var people: [PersonSearchResult] = []
  @State private var collections: [DrinkCollection] = []
  @State private var suggestions: [FriendSuggestion] = []
  @State private var home: DiscoveryHome?
  @State private var error: String?
  @State private var isLoading = false
  private let tokens = KeychainTokenStore()

  public init() {}

  public var body: some View { NavigationStack { List {
    searchSection
    if query.count >= 2 { searchResults } else { exploreSections }
  }.overlay { if isLoading && query.count < 2 { ProgressView() } }
    .navigationTitle("Discover")
    .toolbar { Button { Task { await loadExplore() } } label: { Image(systemName: "arrow.clockwise") }.accessibilityLabel("Refresh discovery") }
    .task { await loadExplore() }.task(id: query) { await searchAfterTyping() }
  } }
  @ViewBuilder private var searchSection: some View { Section("Search") { TextField("Drinks or people", text: $query); if query.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 { Text("Enter at least two characters to search drinks and people.").foregroundStyle(.secondary) }; if isLoading && query.count >= 2 { ProgressView() }; if let error { Text(error).foregroundStyle(.red) } } }
  @ViewBuilder private var searchResults: some View { Section("Drinks") { if drinks.isEmpty && !isLoading { ContentUnavailableView("No drinks found", systemImage: "wineglass") }; ForEach(drinks) { DrinkRow(drink: $0) } }; Section("People") { if people.isEmpty && !isLoading { ContentUnavailableView("No people found", systemImage: "person.slash") }; ForEach(people) { person in PersonRow(name: person.displayName ?? person.username, username: person.username, relationship: person.relationship, action: { action in await transition(person.id, action) }) } } }
  @ViewBuilder private var exploreSections: some View {
    if let home {
      if !home.trending.isEmpty { Section("Trending this week") { ForEach(home.trending, id: \.stableID) { item in HStack { VStack(alignment: .leading) { Text(item.name).font(.headline); Text(item.category).font(.caption).foregroundStyle(.secondary) }; Spacer(); VStack(alignment: .trailing) { Text("\(item.count) logs").font(.caption); if let change = item.percentChange { Text(change >= 0 ? "+\(change)%" : "\(change)%").font(.caption2).foregroundStyle(change >= 0 ? .green : .secondary) } } } } } }
      if let featured = home.drinkOfTheDay { Section("Drink of the day") { VStack(alignment: .leading, spacing: 5) { Text(featured.name).font(.headline); Text(featured.description).font(.caption).foregroundStyle(.secondary); if let instructions = featured.instructions, !instructions.isEmpty { DisclosureGroup("How to make it") { Text(instructions).font(.caption) } } } } }
      if !home.recommendations.isEmpty { Section("You might enjoy") { ForEach(home.recommendations) { item in VStack(alignment: .leading, spacing: 3) { Text(item.name).font(.headline); Text(item.category).font(.caption).foregroundStyle(.secondary); Text(item.reason).font(.caption2).foregroundStyle(.orange) } } } }
    }
    Section("Curated collections") { if collections.isEmpty && !isLoading { Text("No collections are available right now.").foregroundStyle(.secondary) }; ForEach(collections) { collection in NavigationLink { CollectionDetailScreen(collection: collection, client: client) } label: { VStack(alignment: .leading) { Text(collection.title); if let description = collection.description, !description.isEmpty { Text(description).font(.caption).foregroundStyle(.secondary) }; Text("\(collection.drinkCount) drinks").font(.caption2).foregroundStyle(.secondary) } } } }
    Section("Friend suggestions") { if suggestions.isEmpty && !isLoading { Text("Suggestions appear after you and your friends build connections.").foregroundStyle(.secondary) }; ForEach(suggestions) { suggestion in PersonRow(name: suggestion.displayName ?? suggestion.username, username: suggestion.username, relationship: "\(suggestion.mutualCount) mutual", action: { action in await transition(suggestion.id, action) }) } }
  }

  private var client: APIClient? { guard let url = URL(string: apiURL), !apiURL.isEmpty else { return nil }; return APIClient(baseURL: url, tokens: tokens) }
  private func searchAfterTyping() async {
    let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard text.count >= 2 else { drinks = []; people = []; error = nil; return }
    try? await Task.sleep(for: .milliseconds(300))
    guard text == query.trimmingCharacters(in: .whitespacesAndNewlines) else { return }
    guard let client else { error = "Set the API base URL in Profile."; return }
    isLoading = true; defer { isLoading = false }
    do { async let foundDrinks = client.searchDrinks(text); async let foundPeople = client.searchPeople(text); drinks = try await foundDrinks; people = try await foundPeople; error = nil } catch let requestError { error = requestError.localizedDescription }
  }
  private func loadExplore() async {
    guard query.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 else { return }
    guard let client else { error = "Set the API base URL in Profile."; return }
    isLoading = true; defer { isLoading = false }
    do { async let loadedCollections = client.collections(); async let loadedSuggestions = client.suggestions(); async let loadedHome = client.discoveryHome(); collections = try await loadedCollections; suggestions = try await loadedSuggestions; home = try await loadedHome; error = nil } catch let requestError { error = requestError.localizedDescription }
  }
  private func transition(_ id: UUID, _ action: FriendshipAction) async {
    guard let client else { error = "Set the API base URL in Profile."; return }
    do { _ = try await client.transitionFriendship(target: id, action: action); await loadExplore(); if query.count >= 2 { await searchAfterTyping() } } catch { self.error = error.localizedDescription }
  }
}

private struct DrinkRow: View { let drink: DrinkCatalogItem; var body: some View { VStack(alignment: .leading, spacing: 3) { Text(drink.name); if let category = drink.category { Text(category).font(.caption).foregroundStyle(.secondary) }; if let ingredients = drink.ingredients, !ingredients.isEmpty { Text(ingredients.joined(separator: ", ")).font(.caption2).foregroundStyle(.secondary).lineLimit(2) } } } }
private struct PersonRow: View {
  let name: String; let username: String; let relationship: String; let action: (FriendshipAction) async -> Void
  @State private var showActions = false
  var body: some View { HStack { VStack(alignment: .leading) { Text(name); Text("@\(username) · \(relationship)").font(.caption).foregroundStyle(.secondary) }; Spacer(); Button(relationship == "friend" ? "Manage" : "Add") { showActions = true }.buttonStyle(.bordered) }
    .confirmationDialog("Relationship", isPresented: $showActions, titleVisibility: .visible) {
      if relationship == "friend" { Button("Remove friend", role: .destructive) { Task { await action(.remove) } }; Button("Block", role: .destructive) { Task { await action(.block) } } }
      else { Button("Send friend request") { Task { await action(.request) } }; Button("Block", role: .destructive) { Task { await action(.block) } } }
    }
  }
}
private struct CollectionDetailScreen: View {
  let collection: DrinkCollection; let client: APIClient?; @State private var detail: DrinkCollectionDetail?; @State private var error: String?
  var body: some View { List { if let detail { if let description = detail.description { Section { Text(description).foregroundStyle(.secondary) } }; Section("Drinks") { ForEach(detail.drinks) { DrinkRow(drink: $0) } } } else if let error { ContentUnavailableView("Unable to load collection", systemImage: "exclamationmark.triangle", description: Text(error)) } else { ProgressView() } }.navigationTitle(collection.title).task { await load() } }
  private func load() async { guard let client else { error = "Set the API base URL in Profile."; return }; do { detail = try await client.collection(id: collection.id) } catch { self.error = error.localizedDescription } }
}
#endif
