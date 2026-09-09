import Foundation
public enum AppError: LocalizedError, Sendable { case offline, unauthorized, server(String), decoding; public var errorDescription: String? { switch self { case .offline: "You're offline. Your draft is safe and will retry."; case .unauthorized: "Your session ended. Please sign in again."; case .server(let s): s; case .decoding: "The server sent an unexpected response." } } }
public struct Cursor: Codable, Equatable, Sendable { public let takenAt: Date; public let id: UUID; public var encoded: String { Data(try! JSONEncoder.drinkr.encode(self)).base64EncodedString() } }
public struct FeedPost: Codable, Identifiable, Sendable { public let id: UUID; public let authorName: String; public let drinkName: String; public let caption: String?; public let takenAt: Date; public let mediaAssetID: UUID?; public var cheersCount: Int; public var viewerCheered: Bool; public var pending: Bool; enum CodingKeys: String, CodingKey { case id, authorName, drinkName, caption, takenAt, cheersCount, viewerCheered, pending; case mediaAssetID = "mediaAssetId" } }
public struct DrinkCatalogItem: Codable, Identifiable, Sendable { public let id: UUID; public let name: String; public let category: String?; public let imageURL: String?; public let glass: String?; public let ingredients: [String]?; enum CodingKeys: String, CodingKey { case id,name,category,glass,ingredients; case imageURL="imageUrl" } }
public struct PersonSearchResult: Codable, Identifiable, Sendable { public let id: UUID; public let username: String; public let displayName: String?; public let avatarPath: String?; public let relationship: String }
public struct FriendSuggestion: Codable, Identifiable, Sendable { public let id: UUID; public let username: String; public let displayName: String?; public let mutualCount: Int }
public struct DrinkCollection: Codable, Identifiable, Sendable { public let id: UUID; public let slug: String; public let title: String; public let description: String?; public let version: Int; public let drinkCount: Int }
public struct DrinkCollectionDetail: Codable, Identifiable, Sendable { public let id: UUID; public let slug: String; public let title: String; public let description: String?; public let version: Int; public let drinks: [DrinkCatalogItem] }
public enum FriendshipAction: String, Codable, CaseIterable, Sendable { case request, accept, decline, remove, block, unblock }
public struct FriendshipTransition: Codable, Sendable { public let state: String; public let targetID: UUID; enum CodingKeys: String, CodingKey { case state; case targetID="targetId" } }
public struct UserProfile: Codable, Identifiable, Sendable {
  public let id: UUID; public var username: String; public var displayName: String?; public var avatarPath: String?; public let drinkCount: Int; public let friendCount: Int; public let relationship: String
}
public struct ProfilePostsPage: Codable, Sendable { public let posts: [ProfilePost]; public let nextCursor: Cursor? }
public struct ProfilePost: Codable, Identifiable, Sendable { public let id: UUID; public let drinkName: String; public let caption: String?; public let takenAt: Date; public let mediaAssetID: UUID?; public let cheersCount: Int; public let viewerCheered: Bool; enum CodingKeys: String, CodingKey { case id, drinkName, caption, takenAt, cheersCount, viewerCheered; case mediaAssetID = "mediaAssetId" } }
public struct FriendListEntry: Codable, Identifiable, Sendable { public let id: UUID; public let username: String; public let displayName: String?; public let avatarPath: String?; public let friendCount: Int; public let drinkCount: Int }
public struct FriendshipRequest: Codable, Identifiable, Sendable { public let id: UUID; public let direction: String; public let createdAt: Date; public let person: FriendListEntry }
public struct FriendsResponse: Codable, Sendable { public let friends: [FriendListEntry]; public let incoming: [FriendshipRequest]; public let outgoing: [FriendshipRequest] }
public struct NotificationItem: Codable, Identifiable, Sendable { public let id: UUID; public let kind: String; public let payload: [String: JSONValue]; public let readAt: Date?; public let createdAt: Date }
public enum JSONValue: Codable, Sendable { case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null
  public init(from decoder: Decoder) throws { let c = try decoder.singleValueContainer(); if c.decodeNil() { self = .null } else if let v = try? c.decode(Bool.self) { self = .bool(v) } else if let v = try? c.decode(Double.self) { self = .number(v) } else if let v = try? c.decode(String.self) { self = .string(v) } else if let v = try? c.decode([String: JSONValue].self) { self = .object(v) } else { self = .array(try c.decode([JSONValue].self)) } }
  public func encode(to encoder: Encoder) throws { var c=encoder.singleValueContainer(); switch self { case .string(let v): try c.encode(v); case .number(let v): try c.encode(v); case .bool(let v): try c.encode(v); case .object(let v): try c.encode(v); case .array(let v): try c.encode(v); case .null: try c.encodeNil() } }
}
public struct Draft: Codable, Identifiable, Sendable {
  public enum State: String, Codable, Sendable { case local, uploading, finalizing, failed, posted }
  public let id: UUID
  public var imagePath: String
  public var caption: String
  /// The selected catalog drink. Nil represents an unlisted/custom drink.
  public var drinkID: UUID?
  public var drinkType: String
  public var takenAt: Date
  public var timezoneID: String
  public var state: State
  /// Retained across retries so that each command remains idempotent.
  public var uploadKey: UUID
  public var assetID: UUID?
  public var mediaReady: Bool
  public var lastError: String?
  public var attempts: Int
  public init(id: UUID = UUID(), imagePath: String, caption: String = "", drinkID: UUID? = nil, drinkType: String = "Beer", takenAt: Date = .now, timezoneID: String = TimeZone.current.identifier, state: State = .local, uploadKey: UUID = UUID(), assetID: UUID? = nil, mediaReady: Bool = false, lastError: String? = nil, attempts: Int = 0) { self.id=id;self.imagePath=imagePath;self.caption=caption;self.drinkID=drinkID;self.drinkType=drinkType;self.takenAt=takenAt;self.timezoneID=timezoneID;self.state=state;self.uploadKey=uploadKey;self.assetID=assetID;self.mediaReady=mediaReady;self.lastError=lastError;self.attempts=attempts }
  enum CodingKeys: String, CodingKey { case id,imagePath,caption,drinkID,drinkType,takenAt,timezoneID,state,uploadKey,assetID,mediaReady,lastError,attempts }
  public init(from decoder: Decoder) throws { let c=try decoder.container(keyedBy:CodingKeys.self); id=try c.decode(UUID.self,forKey:.id); imagePath=try c.decode(String.self,forKey:.imagePath); caption=try c.decode(String.self,forKey:.caption); drinkID=try c.decodeIfPresent(UUID.self,forKey:.drinkID); drinkType=try c.decode(String.self,forKey:.drinkType); takenAt=try c.decode(Date.self,forKey:.takenAt); timezoneID=try c.decode(String.self,forKey:.timezoneID); state=try c.decode(State.self,forKey:.state); uploadKey=try c.decodeIfPresent(UUID.self,forKey:.uploadKey) ?? id; assetID=try c.decodeIfPresent(UUID.self,forKey:.assetID); mediaReady=try c.decodeIfPresent(Bool.self,forKey:.mediaReady) ?? false; lastError=try c.decodeIfPresent(String.self,forKey:.lastError); attempts=try c.decodeIfPresent(Int.self,forKey:.attempts) ?? 0 }
}
public struct ProgressionSummary: Codable, Sendable, Equatable {
  public var totalXp: Int
  public var level: Int
  public var questsCompleted: Int
  public var achievementsUnlocked: Int
}
public struct QuestProgress: Codable, Identifiable, Sendable, Equatable {
  public let id: UUID
  public let questId: UUID
  public var progress: Int
  public let target: Int
  public var completed: Bool
  public var xpAwarded: Bool
  public let detectionType: String
}
public struct Achievement: Codable, Identifiable, Sendable, Equatable {
  public let id: String
  public let category: String
  public let name: String
  public let description: String
  public let requirementType: String
  public let requirementValue: String
  public let difficulty: String
  public let icon: String
  public let unlockedAt: Date?
  public var unlocked: Bool { unlockedAt != nil }
}
public struct AchievementPage: Codable, Sendable { public let achievements: [Achievement] }
public struct DiscoveryHome: Codable, Sendable {
  public let trending: [TrendingDrink]
  public let drinkOfTheDay: FeaturedDrink?
  public let recommendations: [RecommendedDrink]
}
public struct TrendingDrink: Codable, Identifiable, Sendable { public let id: UUID?; public let name: String; public let category: String; public let imageURL: String?; public let count: Int; public let percentChange: Int?; public var stableID: String { id?.uuidString ?? "category-\(category)" }; enum CodingKeys:String,CodingKey { case id,name,category,count,percentChange; case imageURL="imageUrl" } }
public struct FeaturedDrink: Codable, Identifiable, Sendable { public let id: UUID; public let name: String; public let category: String; public let imageURL: String?; public let description: String; public let instructions: String?; enum CodingKeys:String,CodingKey { case id,name,category,description,instructions; case imageURL="imageUrl" } }
public struct RecommendedDrink: Codable, Identifiable, Sendable { public let id: UUID; public let name: String; public let category: String; public let imageURL: String?; public let reason: String; enum CodingKeys:String,CodingKey { case id,name,category,reason; case imageURL="imageUrl" } }
public struct QuestTodayResponse: Codable, Sendable { public let quest: QuestProgress? }
public struct QuestClaim: Codable, Sendable { public let totalXp: Int; public let level: Int; public let questId: UUID }
public struct Duel: Codable, Identifiable, Sendable { public let id:UUID; public let category:String; public let duration:String; public let status:String; public let startsAt:Date?; public let endsAt:Date?; public let challengerId:UUID; public let challengedId:UUID; public let challengerScore:Int?; public let challengedScore:Int?; public let winnerId:UUID? }
public struct DuelCommand: Encodable, Sendable { public let action:String; public let duelId:UUID?; public let targetId:UUID?; public let category:String?; public let duration:String? }
public struct AnalyticsLog: Codable, Identifiable, Sendable { public let id: UUID; public let drinkType: String; public let createdAt: Date; public let caption: String?; enum CodingKeys: String, CodingKey { case id, caption; case drinkType = "drink_type"; case createdAt = "created_at" } }
public struct AnalyticsSnapshot: Codable, Sendable { public let logs: [AnalyticsLog] }
public struct LeaderboardEntry: Codable, Identifiable, Sendable { public let id: UUID; public let username: String; public let displayName: String?; public let drinkCount: Int; public let rank: Int; public let isViewer: Bool; enum CodingKeys: String, CodingKey { case id = "user_id"; case username; case displayName = "display_name"; case drinkCount = "drink_count"; case rank; case isViewer = "is_viewer" } }
public struct LeaderboardPage: Codable, Sendable { public let entries: [LeaderboardEntry] }
extension JSONEncoder { static var drinkr: JSONEncoder { let e=JSONEncoder();e.dateEncodingStrategy = .iso8601;return e } }
extension JSONDecoder { static var drinkr: JSONDecoder { let d=JSONDecoder();d.dateDecodingStrategy = .iso8601;return d } }
