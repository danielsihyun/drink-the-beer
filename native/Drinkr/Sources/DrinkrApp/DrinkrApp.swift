#if canImport(SwiftUI)
import SwiftUI
#if canImport(PhotosUI)
import PhotosUI
#endif
public struct DrinkrRootView: View { public init() { DrinkrConfiguration.registerDefaults() }; public var body: some View { TabView { FeedScreen().tabItem { Label("Feed", systemImage: "house") }; LogScreen().tabItem { Label("Log", systemImage: "plus.circle") }; ProgressScreen().tabItem { Label("Progress", systemImage: "trophy") }; DiscoverScreen().tabItem { Label("Discover", systemImage: "magnifyingglass") }; ProfileScreen().tabItem { Label("Profile", systemImage: "person") } }.tint(.orange) } }
private struct FeedScreen: View {
  @State private var posts: [FeedPost] = []
  @State private var nextCursor: Cursor?
  @State private var message = "Sign in from Profile to load your private feed."
  @State private var loading = false
  @State private var loadingMore = false
  private let token = KeychainTokenStore()
  private var client: APIClient { APIClient(baseURL: URL(string: DrinkrConfiguration.apiURL)!, tokens: token) }
  var body: some View {
    NavigationStack {
      Group {
        if loading { ProgressView() }
        else if posts.isEmpty { ContentUnavailableView("Your feed", systemImage: "house", description: Text(message)) }
        else { List(posts) { post in
          VStack(alignment: .leading, spacing: 6) {
            if let assetID = post.mediaAssetID { PrivateMediaImage(assetID: assetID, client: client) }
            Text(post.authorName).font(.headline)
            Text(post.drinkName)
            if let caption = post.caption { Text(caption).foregroundStyle(.secondary) }
            HStack { Text(post.takenAt, style: .relative); Spacer(); Button { Task { await toggle(post) } } label: { Label("\(post.cheersCount)", systemImage: post.viewerCheered ? "hands.clap.fill" : "hands.clap") }.buttonStyle(.borderless).accessibilityLabel(post.viewerCheered ? "Remove cheer" : "Cheer this drink") }.font(.caption).foregroundStyle(.secondary)
          }
        }
        if nextCursor != nil { Button { Task { await loadMore() } } label: { loadingMore ? AnyView(ProgressView()) : AnyView(Text("Load more")) }.disabled(loadingMore) }
        }
      }.navigationTitle("Feed").toolbar { Button { Task { await reload() } } label: { Image(systemName: "arrow.clockwise") } }.task { await reload() }
    }
  }
  private func reload() async {
    loading = true
    defer { loading = false }
    do {
      let page = try await client.feed(after: nil)
      posts = page.0
      nextCursor = page.1
      message = "No posts yet."
    } catch { message = error.localizedDescription }
  }
  private func loadMore() async { guard let nextCursor else { return }; loadingMore = true; defer { loadingMore = false }; do { let page = try await client.feed(after: nextCursor); let existing = Set(posts.map(\.id)); posts += page.0.filter { !existing.contains($0.id) }; self.nextCursor = page.1 } catch { message = error.localizedDescription } }
  private func toggle(_ post: FeedPost) async { guard let index = posts.firstIndex(where: { $0.id == post.id }) else { return }; let original = posts[index]; posts[index].viewerCheered.toggle(); posts[index].cheersCount += posts[index].viewerCheered ? 1 : -1; do { try await client.cheer(post.id, posts[index].viewerCheered, UUID()) } catch { posts[index] = original; message = error.localizedDescription } }
}

private struct PrivateMediaImage: View {
  let assetID: UUID; let client: APIClient
  @State private var url: URL?
  var body: some View { Group { if let url { AsyncImage(url: url) { phase in if let image = phase.image { image.resizable().scaledToFill() } else if phase.error != nil { Color.secondary.opacity(0.1).overlay(Image(systemName: "photo")) } else { ProgressView() } }.frame(maxWidth: .infinity).frame(height: 230).clipped().clipShape(RoundedRectangle(cornerRadius: 14)) } else { ProgressView().frame(maxWidth: .infinity, minHeight: 120) } }.task(id: assetID) { url = try? await client.mediaURL(assetID) } }
}
private struct ProgressScreen: View {
  @AppStorage("drinkr.apiURL") private var apiURL = ""
  @State private var model = ProgressionModel()
  @State private var achievementCategory = "All"
  private let token = KeychainTokenStore()
  private var categories: [String] {
    ["All"] + Array(Set(model.achievements.map(\.category))).sorted()
  }
  private var visibleAchievements: [Achievement] {
    model.achievements.filter { achievementCategory == "All" || $0.category == achievementCategory }
  }
  var body: some View {
    NavigationStack {
      Group {
        if model.loading && model.summary == nil { ProgressSkeleton() }
        else if model.summary == nil { ContentUnavailableView("Your progress", systemImage: "trophy", description: Text(model.error ?? "Sign in from Profile to sync your progress.")) }
        else { ScrollView { VStack(spacing: 18) {
          if let summary = model.summary {
            LevelHero(summary: summary)
          }
          VStack(alignment: .leading, spacing: 10) {
            Label("Today's quest", systemImage: "target")
              .font(.headline)
            if let quest = model.quest {
              VStack(alignment: .leading, spacing: 10) {
                Text(quest.detectionType.replacingOccurrences(of: "_", with: " ").capitalized).font(.title3.bold())
                ProgressView(value: Double(quest.progress), total: Double(max(quest.target, 1)))
                  .tint(quest.completed ? .green : .orange)
                  .accessibilityLabel("Quest progress, \(quest.progress) of \(quest.target)")
                HStack { Text("\(quest.progress) of \(quest.target)").font(.caption).foregroundStyle(.secondary); Spacer(); Text(quest.completed ? "Ready" : "In progress").font(.caption.weight(.semibold)).foregroundStyle(quest.completed ? .green : .secondary) }
                if quest.xpAwarded { Label("XP claimed", systemImage: "checkmark.seal.fill").foregroundStyle(.green) }
                else if quest.detectionType == "honor" { Button { Task { await model.honorTodayQuest() } } label: { model.claiming ? AnyView(ProgressView()) : AnyView(Text("Mark complete & claim XP")) }.disabled(model.claiming) }
                else if quest.completed { Button { Task { await model.claimTodayQuest() } } label: { model.claiming ? AnyView(ProgressView()) : AnyView(Text("Claim quest XP")) }.disabled(model.claiming) }
                else { Label("Keep going — progress is calculated on the server.", systemImage: "lock.shield").font(.caption).foregroundStyle(.secondary) }
              }.padding().background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
            } else { ContentUnavailableView("No quest today", systemImage: "calendar", description: Text("Check back when a quest is assigned.")) }
          }
          VStack(alignment: .leading, spacing: 10) {
            HStack { Label("Achievements", systemImage: "medal").font(.headline); Spacer(); Text("\(model.summary?.achievementsUnlocked ?? 0) unlocked").font(.caption).foregroundStyle(.secondary) }
            Picker("Achievement category", selection: $achievementCategory) {
              ForEach(categories, id: \.self) { Text(categoryName($0)).tag($0) }
            }.pickerStyle(.menu).accessibilityHint("Filters achievement cards by category")
            if visibleAchievements.isEmpty { ContentUnavailableView("No achievements here", systemImage: "medal", description: Text("Try a different category or keep logging drinks.")) }
            LazyVStack(spacing: 10) { ForEach(visibleAchievements) { AchievementCard(achievement: $0) } }
          }
          if let error = model.error { Text(error).font(.footnote).foregroundStyle(.red).frame(maxWidth: .infinity, alignment: .leading) }
        }.padding() }
      }
      }.navigationTitle("Progress")
        .toolbar { Button { Task { await configureAndRefresh() } } label: { Image(systemName: "arrow.clockwise") }.disabled(model.loading || model.claiming) }
        .task { await configureAndRefresh() }
    }
  }
  private func categoryName(_ category: String) -> String {
    category == "All" ? category : category.replacingOccurrences(of: "_", with: " ").capitalized
  }
  private func configureAndRefresh() async {
    guard let url = URL(string: apiURL), !apiURL.isEmpty else { await model.refresh(); return }
    model.configure(APIClient(baseURL: url, tokens: token))
    await model.refresh()
  }
}

private struct LevelHero: View {
  let summary: ProgressionSummary
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 3) { Text("LEVEL \(summary.level)").font(.caption.weight(.bold)).foregroundStyle(.orange); Text("Keep the streak alive").font(.title2.bold()) }
        Spacer()
        ZStack { Circle().stroke(.orange.opacity(0.25), lineWidth: 7); Circle().trim(from: 0, to: 0.72).stroke(.orange, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90)); Text("\(summary.level)").font(.title3.bold()) }.frame(width: 58, height: 58).accessibilityLabel("Level \(summary.level)")
      }
      HStack(spacing: 8) { ProgressMetric(value: "\(summary.totalXp)", label: "XP", icon: "bolt.fill"); ProgressMetric(value: "\(summary.questsCompleted)", label: "quests", icon: "checkmark.circle.fill"); ProgressMetric(value: "\(summary.achievementsUnlocked)", label: "awards", icon: "medal.fill") }
    }.padding().background(LinearGradient(colors: [.orange.opacity(0.24), .pink.opacity(0.10)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 22))
  }
}
private struct ProgressMetric: View { let value: String; let label: String; let icon: String; var body: some View { VStack(spacing: 3) { Label(value, systemImage: icon).font(.subheadline.bold()).monospacedDigit(); Text(label).font(.caption2).foregroundStyle(.secondary) }.frame(maxWidth: .infinity).padding(.vertical, 8).background(.background.opacity(0.55), in: RoundedRectangle(cornerRadius: 12)) } }
private struct AchievementCard: View {
  let achievement: Achievement
  private var tint: Color { switch achievement.difficulty.lowercased() { case "diamond": .cyan; case "gold": .yellow; case "silver": .gray; default: .orange } }
  var body: some View { HStack(alignment: .top, spacing: 12) {
    Image(systemName: achievement.unlocked ? "medal.fill" : "lock.fill").font(.title3).foregroundStyle(achievement.unlocked ? tint : .secondary).frame(width: 38, height: 38).background(tint.opacity(achievement.unlocked ? 0.18 : 0.08), in: Circle())
    VStack(alignment: .leading, spacing: 4) { HStack { Text(achievement.unlocked || achievement.category != "secret" ? achievement.name : "Hidden achievement").font(.headline); Spacer(); Text(achievement.difficulty.capitalized).font(.caption2.weight(.bold)).foregroundStyle(tint) }; Text(achievement.unlocked || achievement.category != "secret" ? achievement.description : "Keep exploring to reveal this achievement.").font(.caption).foregroundStyle(.secondary); if let date = achievement.unlockedAt { Text("Unlocked \(date, format: .dateTime.month().day().year())").font(.caption2).foregroundStyle(.green) } }
  }.padding(12).background(tint.opacity(achievement.unlocked ? 0.10 : 0.05), in: RoundedRectangle(cornerRadius: 16)).accessibilityElement(children: .combine).accessibilityLabel("\(achievement.unlocked ? "Unlocked" : "Locked") \(achievement.name), \(achievement.difficulty) difficulty") }
}
private struct ProgressSkeleton: View { var body: some View { ScrollView { VStack(spacing: 16) { RoundedRectangle(cornerRadius: 22).fill(.quaternary).frame(height: 164); ForEach(0..<4, id: \.self) { _ in RoundedRectangle(cornerRadius: 16).fill(.quaternary).frame(height: 86) } }.padding().redacted(reason: .placeholder).accessibilityLabel("Loading your progress") } } }
private struct ProfileScreen: View {
  @AppStorage("drinkr.apiURL") private var apiURL=""; @AppStorage("drinkr.supabaseURL") private var supabaseURL=""; @AppStorage("drinkr.supabaseAnonKey") private var anonKey=""
  @State private var email=""; @State private var password=""; @State private var session=SessionModel(); @State private var profile:UserProfile?; @State private var error:String?; @State private var loading=false
  private let token=KeychainTokenStore()
  var body: some View { NavigationStack { Group { if !session.signedIn { signInForm } else { account } }.navigationTitle("Profile").task { await reload() } } }
  private var client:APIClient? { guard let u=URL(string:apiURL),!apiURL.isEmpty else{return nil}; return APIClient(baseURL:u,tokens:token) }
  private var signInForm: some View { Form { Section("Welcome") { Text("Sign in or create an account to keep your logs private and synced.").foregroundStyle(.secondary) }; Section("Email and password") { TextField("Email",text:$email); SecureField("Password",text:$password); Button("Sign in") { Task { await session.signIn(url:supabaseURL,anonKey:anonKey,email:email,password:password); await reload() } }.buttonStyle(.borderedProminent); Button("Create account") { Task { await session.signUp(url:supabaseURL,anonKey:anonKey,email:email,password:password) } }; Button("Forgot password?") { Task { await session.resetPassword(url:supabaseURL,anonKey:anonKey,email:email) } } }; if let error=session.error { Section { Text(error).foregroundStyle(.secondary) } } } }
  private var account: some View { List { if loading { ProgressView() } else if let profile { Section { HStack { Avatar(name:profile.displayName ?? profile.username); VStack(alignment:.leading) { Text(profile.displayName ?? profile.username).font(.title3.bold()); Text("@\(profile.username)").foregroundStyle(.secondary) } }; HStack { Label("\(profile.drinkCount) drinks",systemImage:"wineglass"); Spacer(); Label("\(profile.friendCount) friends",systemImage:"person.2") }.font(.caption).foregroundStyle(.secondary) }
      Section { NavigationLink("Edit profile",destination: EditProfileScreen(profile:profile,client:client,onSaved:{ saved in self.profile=saved })); NavigationLink("My posts",destination: ProfilePostsScreen(username:profile.username,client:client)); NavigationLink("Insights",destination: InsightsScreen(client:client)); NavigationLink("Leaderboard",destination: LeaderboardScreen(client:client)); NavigationLink("Friends & requests",destination: FriendsScreen(client:client)); NavigationLink("Notifications",destination: NotificationsScreen(client:client)); NavigationLink("Duels",destination:DuelScreen(client:client)); NavigationLink("Privacy & account",destination: AccountSettingsScreen(client:client,onDeleted:{ self.session.signOut(); self.profile=nil })) }
    } else { ContentUnavailableView("Unable to load profile",systemImage:"person.crop.circle.badge.exclamationmark",description:Text(error ?? "Set the API base URL and refresh.")) }
    if let error { Section { Text(error).foregroundStyle(.red) } }; Section { Button("Refresh") { Task { await reload() } }; Button("Sign out",role:.destructive) { session.signOut(); profile=nil } }
  } }
  private func reload() async { guard session.signedIn else{return}; guard let client else { error="Set the API base URL in Profile."; return }; loading=true; defer{loading=false}; do { profile=try await client.myProfile(); error=nil } catch { self.error=error.localizedDescription } }
}

private struct Avatar: View { let name:String; var body:some View { Text(String(name.prefix(1)).uppercased()).font(.headline).frame(width:48,height:48).background(.orange.opacity(0.2),in:Circle()).accessibilityLabel("Avatar for \(name)") } }
private struct EditProfileScreen: View { let profile:UserProfile; let client:APIClient?; let onSaved:(UserProfile)->Void; @Environment(\.dismiss) private var dismiss; @State private var username:String; @State private var displayName:String; @State private var avatarPath:String?; @State private var saving=false; @State private var error:String?
  #if canImport(PhotosUI)
  @State private var avatarSelection:PhotosPickerItem?
  #endif
  init(profile:UserProfile,client:APIClient?,onSaved:@escaping(UserProfile)->Void){self.profile=profile;self.client=client;self.onSaved=onSaved;_username=State(initialValue:profile.username);_displayName=State(initialValue:profile.displayName ?? "");_avatarPath=State(initialValue:profile.avatarPath)}
  var body:some View { let avatarButtonTitle = avatarPath == nil ? "Choose avatar" : "Replace avatar"; return Form { Section("Identity") { TextField("Username",text:$username); TextField("Display name",text:$displayName) }
    Section("Avatar") {
      #if canImport(PhotosUI)
      PhotosPicker(selection:$avatarSelection,matching:.images){Label(avatarButtonTitle,systemImage:"person.crop.circle")}
      #else
      Text("Avatar selection is available in the iOS app.").foregroundStyle(.secondary)
      #endif
    }
    if let error { Section { Text(error).foregroundStyle(.red) } } }.navigationTitle("Edit profile").toolbar { ToolbarItem(placement:.confirmationAction) { Button("Save") { Task { await save() } }.disabled(saving || username.trimmingCharacters(in:.whitespaces).isEmpty) } }.overlay { if saving { ProgressView() } }
    #if canImport(PhotosUI)
    .onChange(of:avatarSelection) { _, item in guard let item else{return}; Task { await uploadAvatar(item) } }
    #endif
  }
  #if canImport(PhotosUI)
  private func uploadAvatar(_ item:PhotosPickerItem) async { guard let client else {error="Set the API base URL in Profile.";return}; guard let data=try? await item.loadTransferable(type:Data.self) else {error="Unable to read that photo.";return}; saving=true;defer{saving=false};do { avatarPath=try await client.uploadAvatar(data);avatarSelection=nil }catch{self.error=error.localizedDescription} }
  #endif
  private func save() async { guard let client else {error="Set the API base URL in Profile.";return}; saving=true;defer{saving=false};do { let saved=try await client.updateProfile(username:username.trimmingCharacters(in:.whitespacesAndNewlines),displayName:displayName.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty ? nil:displayName.trimmingCharacters(in:.whitespacesAndNewlines),avatarPath:avatarPath);onSaved(saved);dismiss() } catch { self.error=error.localizedDescription } }
}
private struct ProfilePostsScreen: View {
  let username:String; let client:APIClient?
  @State private var page:ProfilePostsPage?; @State private var error:String?
  @State private var deleting: UUID?; @State private var pendingDelete: ProfilePost?
  var body:some View {
    List {
      if let posts=page?.posts {
        if posts.isEmpty { ContentUnavailableView("No drinks yet",systemImage:"wineglass") }
        ForEach(posts) { p in
          VStack(alignment:.leading,spacing:5) {
            HStack { Text(p.drinkName).font(.headline); Spacer(); Menu { Button("Delete drink", role:.destructive) { pendingDelete=p } } label: { Image(systemName:"ellipsis.circle") }.disabled(deleting == p.id) }
            if let c=p.caption, !c.isEmpty { Text(c) }
            HStack { Text(p.takenAt,style:.date); Spacer(); if deleting == p.id { ProgressView() } else { Label("\(p.cheersCount)",systemImage:"hands.clap") } }.font(.caption).foregroundStyle(.secondary)
          }
        }
      } else if let error { ContentUnavailableView("Unable to load posts",systemImage:"exclamationmark.triangle",description:Text(error)) } else { ProgressView() }
    }
    .navigationTitle("Posts")
    .confirmationDialog("Delete this drink?", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete=nil } }), titleVisibility:.visible) {
      Button("Delete drink", role:.destructive) { if let post=pendingDelete { Task { await delete(post) } } }
    } message: { Text("Its photo and post will be removed from your feed. This cannot be undone.") }
    .task { await load() }
  }
  private func load() async { guard let client else {error="Set the API base URL in Profile.";return}; do {page=try await client.profilePosts(username:username);error=nil}catch{self.error=error.localizedDescription} }
  private func delete(_ post:ProfilePost) async { guard let client else{return}; deleting=post.id; defer {deleting=nil}; do { try await client.deletePost(post.id); if let page { self.page=ProfilePostsPage(posts: page.posts.filter{$0.id != post.id},nextCursor:page.nextCursor) }; pendingDelete=nil } catch { self.error=error.localizedDescription } }
}
private struct FriendsScreen: View {
  let client: APIClient?
  @State private var data: FriendsResponse?
  @State private var error: String?
  @State private var working: Set<UUID> = []
  var body: some View {
    List {
      if let data {
        Section("Friends") {
          if data.friends.isEmpty { Text("No friends yet.").foregroundStyle(.secondary) }
          ForEach(data.friends) { personRow($0, actions: [.remove, .block]) }
        }
        Section("Requests") {
          if data.incoming.isEmpty && data.outgoing.isEmpty { Text("No pending requests.").foregroundStyle(.secondary) }
          ForEach(data.incoming) { requestRow($0, actions: [.accept, .decline, .block]) }
          ForEach(data.outgoing) { requestRow($0, actions: [.remove]) }
        }
      } else if let error { ContentUnavailableView("Unable to load friends", systemImage:"person.2.slash", description:Text(error)) }
      else { ProgressView() }
    }
    .navigationTitle("Friends")
    .toolbar { Button { Task { await load() } } label: { Image(systemName:"arrow.clockwise") } }
    .task { await load() }
  }
  private func requestRow(_ request: FriendshipRequest, actions: [FriendshipAction]) -> some View {
    HStack { VStack(alignment:.leading) { Text(request.person.displayName ?? request.person.username); Text("@\(request.person.username) · \(request.direction)").font(.caption).foregroundStyle(.secondary) }; Spacer(); actionMenu(request.person.id, actions:actions) }
  }
  private func personRow(_ person: FriendListEntry, actions: [FriendshipAction]) -> some View {
    HStack { Avatar(name:person.displayName ?? person.username); VStack(alignment:.leading) { Text(person.displayName ?? person.username); Text("@\(person.username)").font(.caption).foregroundStyle(.secondary) }; Spacer(); actionMenu(person.id, actions:actions) }
  }
  private func actionMenu(_ id: UUID, actions: [FriendshipAction]) -> some View {
    Menu("Manage") { ForEach(actions, id:\.self) { action in Button(action.rawValue.capitalized, role: action == .accept ? nil : .destructive) { Task { await change(id, action) } } } }.disabled(working.contains(id))
  }
  private func load() async { guard let client else { self.error="Set the API base URL in Profile."; return }; do { data=try await client.friends(); error=nil } catch { self.error=error.localizedDescription } }
  private func change(_ id: UUID, _ action: FriendshipAction) async { guard let client else{return}; working.insert(id); defer { working.remove(id) }; do { _=try await client.transitionFriendship(target:id,action:action); await load() } catch { self.error=error.localizedDescription } }
}
private struct NotificationsScreen: View { let client:APIClient?; @State private var items:[NotificationItem]=[]; @State private var error:String?; var body:some View { List { if items.isEmpty && error==nil { ContentUnavailableView("No notifications",systemImage:"bell") }; ForEach(items){n in VStack(alignment:.leading,spacing:4){Text(notificationTitle(n)).font(n.readAt == nil ? .headline : .body);Text(n.createdAt,style:.relative).font(.caption).foregroundStyle(.secondary)} }; if let error {Text(error).foregroundStyle(.red)} }.navigationTitle("Notifications").task{guard let client else{error="Set the API base URL in Profile.";return};do{items=try await client.notifications();let unread=items.filter{$0.readAt == nil}.map(\.id);if !unread.isEmpty {try await client.markNotificationsRead(unread)}}catch{self.error=error.localizedDescription}} }
  private func notificationTitle(_ item:NotificationItem)->String { switch item.kind { case "friend.request": return "You have a new friend request"; case "friend.accepted": return "Your friend request was accepted"; case "duel.challenge": return "You have a duel challenge"; case "duel.completed": return "A duel has finished"; case "drink.cheer": return "Someone cheered your drink"; default:return item.kind.replacingOccurrences(of:".",with:" ").capitalized } }
}
#endif
