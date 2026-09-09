import Foundation
import Observation

@MainActor @Observable public final class ProgressionModel {
  public private(set) var summary: ProgressionSummary?
  public private(set) var quest: QuestProgress?
  public private(set) var achievements: [Achievement] = []
  public private(set) var loading = false
  public private(set) var claiming = false
  public private(set) var error: String?
  private var repository: (any ProgressionRepository)?

  public init(repository: (any ProgressionRepository)? = nil) { self.repository = repository }
  public func configure(_ repository: any ProgressionRepository) { self.repository = repository }
  public func refresh() async {
    guard let repository else { error = "Set the API base URL in Profile, then sign in."; return }
    loading = true; defer { loading = false }
    do {
      async let loadedSummary = repository.progression()
      async let loadedQuest = repository.todaysQuest()
      async let loadedAchievements = repository.achievements()
      summary = try await loadedSummary
      quest = try await loadedQuest
      achievements = try await loadedAchievements
      error = nil
    } catch { self.error = error.localizedDescription }
  }
  public func claimTodayQuest() async {
    guard let repository, let quest, quest.completed, !quest.xpAwarded else { return }
    claiming = true; defer { claiming = false }
    do {
      let claim = try await repository.claimQuest(quest.id, key: UUID())
      summary?.totalXp = claim.totalXp
      summary?.level = claim.level
      summary?.questsCompleted += 1
      self.quest?.xpAwarded = true
      error = nil
    } catch { self.error = error.localizedDescription }
  }
  public func honorTodayQuest() async {
    guard let repository, let quest, quest.detectionType == "honor", !quest.xpAwarded else { return }
    claiming = true; defer { claiming = false }
    do {
      let claim = try await repository.honorQuest(quest.id, key: UUID())
      summary?.totalXp = claim.totalXp; summary?.level = claim.level; summary?.questsCompleted += 1
      self.quest?.progress = self.quest?.target ?? 0; self.quest?.completed = true; self.quest?.xpAwarded = true; error = nil
    } catch { self.error = error.localizedDescription }
  }
}
