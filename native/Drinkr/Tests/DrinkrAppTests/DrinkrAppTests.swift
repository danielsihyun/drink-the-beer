import XCTest
@testable import DrinkrApp
final class DrinkrAppTests:XCTestCase{
  func testCursorIsStable(){let c=Cursor(takenAt:Date(timeIntervalSince1970:1),id:UUID());XCTAssertFalse(c.encoded.isEmpty)}
  func testDraftDefaultsToLocal(){XCTAssertEqual(Draft(imagePath:"a").state,.local)}
  func testDraftPersistsSelectedCatalogDrink(){let id=UUID();let draft=Draft(imagePath:"a",drinkID:id);let restored=try! JSONDecoder.drinkr.decode(Draft.self,from:JSONEncoder.drinkr.encode(draft));XCTAssertEqual(restored.drinkID,id)}
  func testFinalizeInputIncludesOptionalDrinkID(){let id=UUID();let data=try! JSONEncoder.drinkr.encode(FinalizePostInput(assetID:UUID(),drinkID:id,drinkType:"Beer",caption:"",takenAt:Date(timeIntervalSince1970:0),timezoneID:"UTC",timezoneOffsetMinutes:0));let json=String(data:data,encoding:.utf8)!;XCTAssertNotNil(json.range(of:id.uuidString,options:.caseInsensitive))}
  func testDiscoveryContractDecodes(){let id=UUID();let data=Data("{\"id\":\"\(id)\",\"name\":\"Lager\",\"imageUrl\":null}".utf8);let drink=try! JSONDecoder.drinkr.decode(DrinkCatalogItem.self,from:data);XCTAssertEqual(drink.id,id);XCTAssertNil(drink.imageURL)}
  func testFeedContractAcceptsFractionalPostgresTimestamps(){let id=UUID();let data=Data("{\"posts\":[{\"id\":\"\(id)\",\"authorName\":\"Sam\",\"drinkName\":\"Lager\",\"caption\":null,\"takenAt\":\"2026-09-09T01:20:11.123456+00:00\",\"mediaAssetId\":null,\"cheersCount\":0,\"viewerCheered\":false,\"pending\":false}],\"nextCursor\":null}".utf8);let page=try! JSONDecoder.drinkr.decode(FeedPage.self,from:data);XCTAssertEqual(page.posts.first?.id,id)}
  func testAchievementContractDecodes(){let data=Data("{\"id\":\"first\",\"category\":\"total_drinks\",\"name\":\"First\",\"description\":\"Log one\",\"requirementType\":\"count\",\"requirementValue\":\"1\",\"difficulty\":\"bronze\",\"icon\":\"medal\",\"unlockedAt\":null}".utf8);let item=try! JSONDecoder.drinkr.decode(Achievement.self,from:data);XCTAssertFalse(item.unlocked)}
  func testDuelContractDecodesAndChallengeEncodes(){let ids=(UUID(),UUID(),UUID());let data=Data("{\"id\":\"\(ids.0)\",\"category\":\"total_drinks\",\"duration\":\"1D\",\"status\":\"pending\",\"startsAt\":null,\"endsAt\":null,\"challengerId\":\"\(ids.1)\",\"challengedId\":\"\(ids.2)\",\"challengerScore\":null,\"challengedScore\":null,\"winnerId\":null}".utf8);let duel=try! JSONDecoder.drinkr.decode(Duel.self,from:data);XCTAssertEqual(duel.status,"pending");let command=DuelCommand(action:"challenge",duelId:nil,targetId:ids.2,category:"total_drinks",duration:"1D");let json=String(data:try! JSONEncoder.drinkr.encode(command),encoding:.utf8)!;XCTAssertTrue(json.contains("challenge"));XCTAssertTrue(json.localizedCaseInsensitiveContains(ids.2.uuidString))}
  @MainActor func testProgressionRefreshAndClaim() async {
    let quest = QuestProgress(id: UUID(), questId: UUID(), progress: 1, target: 1, completed: true, xpAwarded: false, detectionType: "log_count")
    let model = ProgressionModel(repository: ProgressionStub(quest: quest))
    await model.refresh()
    XCTAssertEqual(model.summary?.level, 2)
    XCTAssertEqual(model.quest?.id, quest.id)
    await model.claimTodayQuest()
    XCTAssertEqual(model.summary?.totalXp, 50)
    XCTAssertTrue(model.quest?.xpAwarded == true)
  }
}
private struct FeedPage:Decodable { let posts:[FeedPost]; let nextCursor:Cursor? }
private struct ProgressionStub: ProgressionRepository {
  let quest: QuestProgress
  func progression() async throws -> ProgressionSummary { ProgressionSummary(totalXp: 30, level: 2, questsCompleted: 1, achievementsUnlocked: 4) }
  func todaysQuest() async throws -> QuestProgress? { quest }
  func claimQuest(_ id: UUID, key: UUID) async throws -> QuestClaim { QuestClaim(totalXp: 50, level: 2, questId: id) }
  func honorQuest(_ id: UUID, key: UUID) async throws -> QuestClaim { QuestClaim(totalXp: 50, level: 2, questId: id) }
  func achievements() async throws -> [Achievement] { [] }
}
