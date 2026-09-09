import Foundation
import XCTest
@testable import DrinkrApp

/// A read-only smoke suite for a dedicated integration account. It avoids all
/// command endpoints, so it never mutates the configured account's data.
final class LiveIntegrationTests: XCTestCase {
  func testAuthenticatedReadContractsWhenConfigured() async throws {
    let client = try configuredClient()
    let (posts, cursor) = try await client.feed(after: nil)
    XCTAssertLessThanOrEqual(posts.count, 20)
    if let cursor {
      XCTAssertFalse(cursor.encoded.isEmpty)
      let (nextPosts, _) = try await client.feed(after: cursor)
      XCTAssertLessThanOrEqual(nextPosts.count, 20)
    }
    let progression = try await client.progression()
    XCTAssertGreaterThanOrEqual(progression.totalXp, 0)
    XCTAssertGreaterThanOrEqual(progression.level, 1)
    let achievements = try await client.achievements()
    XCTAssertFalse(achievements.contains { $0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })

    _ = try await client.discoveryHome()
    let drinks = try await client.searchDrinks("beer")
    XCTAssertLessThanOrEqual(drinks.count, 20)
    let people = try await client.searchPeople("zz")
    XCTAssertLessThanOrEqual(people.count, 20)
    let suggestions = try await client.suggestions()
    XCTAssertLessThanOrEqual(suggestions.count, 20)
    let collections = try await client.collections()
    if let collection = collections.first {
      let detail = try await client.collection(id: collection.id)
      XCTAssertEqual(detail.id, collection.id)
    }

    let profile = try await client.myProfile()
    XCTAssertFalse(profile.username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    let profilePosts = try await client.profilePosts(username: profile.username)
    XCTAssertLessThanOrEqual(profilePosts.posts.count, 20)
    let friends = try await client.friends()
    XCTAssertGreaterThanOrEqual(friends.friends.count + friends.incoming.count + friends.outgoing.count, 0)
    _ = try await client.notifications()
    _ = try await client.duels()
  }

  private func configuredClient() throws -> APIClient {
    let environment = ProcessInfo.processInfo.environment
    guard let rawURL = environment["DRINKR_INTEGRATION_API_URL"],
          let url = URL(string: rawURL), url.scheme == "https",
          let token = environment["DRINKR_INTEGRATION_ACCESS_TOKEN"], !token.isEmpty else {
      throw XCTSkip("Set DRINKR_INTEGRATION_API_URL (https) and DRINKR_INTEGRATION_ACCESS_TOKEN from a dedicated test account. This suite performs only authenticated GET requests.")
    }
    return APIClient(baseURL: url, tokens: StaticToken(token))
  }
}

private struct StaticToken: TokenProviding {
  let value: String
  init(_ value: String) { self.value = value }
  func token() async throws -> String { value }
}
