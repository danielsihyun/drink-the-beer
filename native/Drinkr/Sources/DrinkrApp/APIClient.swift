import Foundation
public protocol TokenProviding: Sendable { func token() async throws -> String }
public protocol FeedRepository: Sendable { func feed(after: Cursor?) async throws -> ([FeedPost], Cursor?); func cheer(_ id: UUID, _ desired: Bool, _ key: UUID) async throws }
public protocol ProgressionRepository: Sendable { func progression() async throws -> ProgressionSummary; func todaysQuest() async throws -> QuestProgress?; func claimQuest(_ id: UUID, key: UUID) async throws -> QuestClaim; func honorQuest(_ id: UUID, key: UUID) async throws -> QuestClaim; func achievements() async throws -> [Achievement] }
public actor APIClient: FeedRepository, ProgressionRepository {
  let baseURL: URL; let tokens: TokenProviding; let session: URLSession
  public init(baseURL: URL, tokens: TokenProviding, session: URLSession = .shared) { self.baseURL = baseURL; self.tokens = tokens; self.session = session }
  public func feed(after cursor: Cursor?) async throws -> ([FeedPost], Cursor?) { var components = URLComponents(url: baseURL.appending(path: "v2/feed"), resolvingAgainstBaseURL: false)!; components.queryItems = [URLQueryItem(name: "limit", value: "20")] + (cursor.map { [URLQueryItem(name: "cursor", value: $0.encoded)] } ?? []); let page: Page = try await request(components.url!, "GET", nil, nil); return (page.posts, page.nextCursor) }
  public func cheer(_ id: UUID, _ desired: Bool, _ key: UUID) async throws { let body = try JSONEncoder().encode(["desired": desired]); let _: Empty = try await request(baseURL.appending(path: "v2/posts/\(id)/cheer"), "PUT", body, key) }
  public func progression() async throws -> ProgressionSummary { try await request(baseURL.appending(path: "v2/progression"), "GET", nil, nil) }
  public func todaysQuest() async throws -> QuestProgress? { let response: QuestTodayResponse = try await request(baseURL.appending(path: "v2/quests/today"), "GET", nil, nil); return response.quest }
  public func claimQuest(_ id: UUID, key: UUID) async throws -> QuestClaim { try await request(baseURL.appending(path: "v2/quests/\(id)/claim"), "POST", nil, key) }
  public func honorQuest(_ id: UUID, key: UUID) async throws -> QuestClaim { try await request(baseURL.appending(path: "v2/quests/\(id)/honor"), "POST", nil, key) }
  public func achievements() async throws -> [Achievement] { let page: AchievementPage = try await request(baseURL.appending(path: "v2/progression/achievements"), "GET", nil, nil); return page.achievements }
  public func discoveryHome() async throws -> DiscoveryHome { try await request(baseURL.appending(path: "v2/discover/home"), "GET", nil, nil) }
  public func searchDrinks(_ query: String) async throws -> [DrinkCatalogItem] { let response: DrinksResponse = try await get("v2/discover/drinks", query: query); return response.drinks }
  public func createCustomDrink(name: String, category: String, key: UUID = UUID()) async throws -> DrinkCatalogItem {
    struct Input: Encodable { let name: String; let category: String }
    let response: CustomDrinkResponse = try await request(baseURL.appending(path: "v2/drinks"), "POST", JSONEncoder.drinkr.encode(Input(name: name, category: category)), key)
    return response.drink
  }
  public func searchPeople(_ query: String) async throws -> [PersonSearchResult] { let response: PeopleResponse = try await get("v2/discover/people", query: query); return response.people }
  public func suggestions() async throws -> [FriendSuggestion] { let response: SuggestionsResponse = try await request(baseURL.appending(path: "v2/discover/suggestions"), "GET", nil, nil); return response.suggestions }
  public func collections() async throws -> [DrinkCollection] { let response: CollectionsResponse = try await request(baseURL.appending(path: "v2/discover/collections"), "GET", nil, nil); return response.collections }
  public func collection(id: UUID) async throws -> DrinkCollectionDetail { let response: CollectionResponse = try await request(baseURL.appending(path: "v2/discover/collections/\(id)"), "GET", nil, nil); return response.collection }
  public func transitionFriendship(target: UUID, action: FriendshipAction, key: UUID = UUID()) async throws -> FriendshipTransition { let body = try JSONEncoder().encode(["action": action.rawValue]); return try await request(baseURL.appending(path: "v2/friendships/\(target)"), "POST", body, key) }
  public func myProfile() async throws -> UserProfile { try await request(baseURL.appending(path: "v2/profile"), "GET", nil, nil) }
  public func updateProfile(username: String, displayName: String?, avatarPath: String? = nil) async throws -> UserProfile {
    struct Input: Encodable { let username: String; let displayName: String?; let avatarPath: String? }
    return try await request(baseURL.appending(path: "v2/profile"), "PATCH", JSONEncoder.drinkr.encode(Input(username: username, displayName: displayName, avatarPath: avatarPath)), UUID())
  }
  public func uploadAvatar(_ data: Data, mimeType: String = "image/jpeg") async throws -> String {
    struct Input: Encodable { let mimeType:String; let byteSize:Int }
    let authorization: AvatarUploadAuthorization = try await request(baseURL.appending(path:"v2/profile/avatar"), "POST", JSONEncoder.drinkr.encode(Input(mimeType:mimeType,byteSize:data.count)), UUID())
    try await uploadImage(data, authorization: MediaUploadAuthorization(assetID: UUID(), path: authorization.path, signedURL: authorization.signedURL, token: authorization.token), mimeType: mimeType)
    return authorization.path
  }
  public func profile(username: String) async throws -> UserProfile { try await request(baseURL.appending(path: "v2/profiles/\(username.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? username)"), "GET", nil, nil) }
  public func profilePosts(username: String, after: Cursor? = nil) async throws -> ProfilePostsPage { var c=URLComponents(url:baseURL.appending(path:"v2/profiles/\(username.addingPercentEncoding(withAllowedCharacters:.urlPathAllowed) ?? username)/posts"),resolvingAgainstBaseURL:false)!; c.queryItems=(after.map{[URLQueryItem(name:"cursor",value:$0.encoded)]} ?? [])+[URLQueryItem(name:"limit",value:"20")]; return try await request(c.url!, "GET", nil, nil) }
  public func friends() async throws -> FriendsResponse { try await request(baseURL.appending(path: "v2/friends"), "GET", nil, nil) }
  public func notifications() async throws -> [NotificationItem] { let r: NotificationsResponse = try await request(baseURL.appending(path: "v2/notifications"), "GET", nil, nil); return r.notifications }
  public func markNotificationsRead(_ ids: [UUID]? = nil) async throws { struct Input: Encodable { let ids: [UUID]? }; let _: MarkReadResponse = try await request(baseURL.appending(path: "v2/notifications"), "PATCH", JSONEncoder.drinkr.encode(Input(ids: ids)), UUID()) }
  private func get<T: Decodable>(_ path: String, query: String) async throws -> T { var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!; components.queryItems = [URLQueryItem(name: "q", value: query), URLQueryItem(name: "limit", value: "20")]; return try await request(components.url!, "GET", nil, nil) }
  public func createUpload(_ input: MediaUploadInput, key: UUID) async throws -> MediaUploadAuthorization { try await request(baseURL.appending(path:"v2/media/uploads"), "POST", JSONEncoder.drinkr.encode(input), key) }
  public func uploadImage(_ data: Data, authorization: MediaUploadAuthorization, mimeType: String) async throws { var request=URLRequest(url:authorization.signedURL); request.httpMethod="PUT"; request.setValue(mimeType,forHTTPHeaderField:"Content-Type"); let (_,response)=try await session.upload(for:request,from:data); guard let http=response as? HTTPURLResponse,200..<300 ~= http.statusCode else { throw AppError.server("Photo upload failed. It will retry when you try again.") } }
  public func completeUpload(_ assetID: UUID) async throws { let _: Empty = try await request(baseURL.appending(path:"v2/media/\(assetID)/complete"), "POST", nil, nil) }
  public func mediaURL(_ assetID: UUID) async throws -> URL { struct Reply: Decodable { let url: URL }; let reply: Reply = try await request(baseURL.appending(path: "v2/media/\(assetID)"), "GET", nil, nil); return reply.url }
  public func finalize(_ input: FinalizePostInput, key: UUID) async throws -> UUID { let result: FinalizePostReply = try await request(baseURL.appending(path:"v2/posts"), "POST", JSONEncoder.drinkr.encode(input), key); return result.id }
  public func duels() async throws -> [Duel] { let r:DuelListResponse = try await request(baseURL.appending(path:"v2/duels"),"GET",nil,nil); return r.duels }
  public func duel(_ command:DuelCommand,key:UUID=UUID()) async throws -> Duel { try await request(baseURL.appending(path:"v2/duels"),"POST",JSONEncoder.drinkr.encode(command),key) }
  public func deletePost(_ id: UUID, key: UUID = UUID()) async throws { let _: Empty = try await request(baseURL.appending(path:"v2/posts/\(id)"), "DELETE", nil, key) }
  public func deleteAccount() async throws { let _: Empty = try await request(baseURL.appending(path: "v2/account"), "DELETE", nil, UUID()) }
  public func analytics() async throws -> AnalyticsSnapshot { try await request(baseURL.appending(path: "analytics"), "GET", nil, nil) }
  public func leaderboard(scope: String = "friends", days: Int? = nil) async throws -> LeaderboardPage { var components = URLComponents(url: baseURL.appending(path: "leaderboard"), resolvingAgainstBaseURL: false)!; var items = [URLQueryItem(name: "scope", value: scope), URLQueryItem(name: "limit", value: "100")]; if let days { items.append(URLQueryItem(name: "start_date", value: ISO8601DateFormatter().string(from: Calendar.current.date(byAdding: .day, value: -days, to: .now) ?? .distantPast))) }; components.queryItems = items; return try await request(components.url!, "GET", nil, nil) }
  private func request<T: Decodable>(_ url: URL, _ method: String, _ body: Data?, _ key: UUID?) async throws -> T { var request = URLRequest(url: url); request.httpMethod = method; request.httpBody = body; request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.setValue("Bearer \(try await tokens.token())", forHTTPHeaderField: "Authorization"); if let key { request.setValue(key.uuidString, forHTTPHeaderField: "Idempotency-Key") }; do { let (data, response) = try await session.data(for: request); guard let http = response as? HTTPURLResponse else { throw AppError.offline }; guard http.statusCode != 401 else { throw AppError.unauthorized }; guard 200..<300 ~= http.statusCode else { throw AppError.server(apiErrorMessage(data: data, response: http)) }; if T.self == Empty.self { return Empty() as! T }; return try JSONDecoder.drinkr.decode(T.self, from: data) } catch let error as AppError { throw error } catch { throw AppError.offline } }
  private func apiErrorMessage(data: Data, response: HTTPURLResponse) -> String { if response.value(forHTTPHeaderField: "Content-Type")?.localizedCaseInsensitiveContains("text/html") == true { return "The app server is not running the required API. Please update the app or try again shortly." }; return String(data: data, encoding: .utf8) ?? "Request failed" }
}
public struct MediaUploadInput: Encodable, Sendable { public let contentHash:String; public let mimeType:String; public let byteSize:Int; public let width:Int?; public let height:Int?; public init(contentHash:String,mimeType:String,byteSize:Int,width:Int?,height:Int?){self.contentHash=contentHash;self.mimeType=mimeType;self.byteSize=byteSize;self.width=width;self.height=height} }
public struct MediaUploadAuthorization: Decodable, Sendable { public let assetID:UUID; public let path:String; public let signedURL:URL; public let token:String; public init(assetID:UUID,path:String,signedURL:URL,token:String){self.assetID=assetID;self.path=path;self.signedURL=signedURL;self.token=token}; enum CodingKeys:String,CodingKey { case assetID="assetId",path,signedURL="signedUrl",token } }
private struct AvatarUploadAuthorization: Decodable, Sendable { let path:String; let signedURL:URL; let token:String; enum CodingKeys:String,CodingKey { case path,signedURL="signedUrl",token } }
public struct FinalizePostInput: Encodable, Sendable { public let assetID:UUID; public let drinkID:UUID?; public let drinkType:String; public let caption:String; public let takenAt:Date; public let timezoneID:String; public let timezoneOffsetMinutes:Int; public init(assetID:UUID,drinkID:UUID?=nil,drinkType:String,caption:String,takenAt:Date,timezoneID:String,timezoneOffsetMinutes:Int){self.assetID=assetID;self.drinkID=drinkID;self.drinkType=drinkType;self.caption=caption;self.takenAt=takenAt;self.timezoneID=timezoneID;self.timezoneOffsetMinutes=timezoneOffsetMinutes}; enum CodingKeys:String,CodingKey { case assetID="assetId",drinkID="drinkId",drinkType,caption,takenAt,timezoneID="timezoneId",timezoneOffsetMinutes } }
private struct FinalizePostReply: Decodable { let id: UUID }
private struct Page: Decodable { let posts: [FeedPost]; let nextCursor: Cursor? }
private struct Empty: Decodable {}
private struct DrinksResponse: Decodable { let drinks: [DrinkCatalogItem] }
private struct CustomDrinkResponse: Decodable { let drink: DrinkCatalogItem }
private struct PeopleResponse: Decodable { let people: [PersonSearchResult] }
private struct SuggestionsResponse: Decodable { let suggestions: [FriendSuggestion] }
private struct CollectionsResponse: Decodable { let collections: [DrinkCollection] }
private struct CollectionResponse: Decodable { let collection: DrinkCollectionDetail }
private struct DuelListResponse: Decodable { let duels:[Duel] }
private struct NotificationsResponse: Decodable { let notifications: [NotificationItem] }
private struct MarkReadResponse: Decodable { let updated: Int }
