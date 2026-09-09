import Foundation
import Observation
import CryptoKit
#if canImport(UIKit)
import UIKit
#endif

public struct PreparedPhoto: Sendable {
  let data: Data
  let width: Int?
  let height: Int?
  let hash: String
  static func make(from data: Data) throws -> PreparedPhoto {
    #if canImport(UIKit)
    guard let image=UIImage(data:data) else { throw AppError.server("That photo could not be read.") }
    var quality: CGFloat=0.88
    var encoded=image.jpegData(compressionQuality:quality)
    while let current=encoded, current.count > 15_000_000, quality > 0.25 { quality -= 0.12; encoded=image.jpegData(compressionQuality:quality) }
    guard let jpeg=encoded, jpeg.count <= 15_000_000 else { throw AppError.server("Choose a photo smaller than 15 MB.") }
    let digest=SHA256.hash(data:jpeg).map { String(format:"%02x",$0) }.joined()
    return PreparedPhoto(data:jpeg,width:Int(image.size.width * image.scale),height:Int(image.size.height * image.scale),hash:digest)
    #else
    throw AppError.server("Photo uploads are available on iOS.")
    #endif
  }
}

@MainActor @Observable public final class DrinkLogger {
  public private(set) var drafts:[Draft]=[]
  public private(set) var working=false
  public private(set) var message:String?
  private let store:LocalStore
  private let outbox:DraftOutbox
  public init(store:LocalStore?=nil) throws { let actual=try store ?? LocalStore(); self.store=actual; self.outbox=DraftOutbox(store:actual) }
  public func load() async { do { drafts=try await outbox.all().filter{$0.state != .posted} } catch { message=error.localizedDescription } }
  public func savePhoto(_ data:Data, caption:String, drinkID: UUID? = nil, drinkType:String, takenAt:Date) async {
    do { let prepared=try PreparedPhoto.make(from:data); let id=UUID(); let path=try await store.saveImage(prepared.data,named:id.uuidString); let draft=Draft(id:id,imagePath:path,caption:String(caption.prefix(280)).trimmingCharacters(in:.whitespacesAndNewlines),drinkID:drinkID,drinkType:drinkType,takenAt:takenAt); try await outbox.save(draft); drafts.append(draft); message="Saved locally. Publish when you’re online." } catch { message=error.localizedDescription }
  }
  public func publish(_ draft:Draft, apiURL:String) async {
    guard let baseURL=URL(string:apiURL), !apiURL.isEmpty else { message="Set the API base URL in Profile before publishing."; return }
    working=true; defer { working=false }
    var current=draft
    do {
      current.state = .uploading; current.lastError=nil; current.attempts += 1; try await persist(current)
      let client=APIClient(baseURL:baseURL,tokens:KeychainTokenStore())
      if !current.mediaReady {
        let photo=try PreparedPhoto.make(from:try await store.image(at:current.imagePath))
        // Repeating this command with its stable key renews a signed URL for the same asset.
        let authorization=try await client.createUpload(MediaUploadInput(contentHash:photo.hash,mimeType:"image/jpeg",byteSize:photo.data.count,width:photo.width,height:photo.height),key:current.uploadKey)
        if let existing=current.assetID, existing != authorization.assetID { throw AppError.server("Upload could not be resumed safely.") }
        current.assetID=authorization.assetID; try await persist(current)
        try await client.uploadImage(photo.data,authorization:authorization,mimeType:"image/jpeg")
        try await client.completeUpload(authorization.assetID)
        current.mediaReady=true
      }
      current.state = .finalizing; try await persist(current)
      guard let assetID=current.assetID else { throw AppError.server("Photo preparation did not complete.") }
      _ = try await client.finalize(FinalizePostInput(assetID:assetID,drinkID:current.drinkID,drinkType:current.drinkType,caption:current.caption,takenAt:current.takenAt,timezoneID:current.timezoneID,timezoneOffsetMinutes:TimeZone.current.secondsFromGMT(for:current.takenAt)/60),key:current.uploadKey)
      try await outbox.remove(current); try? await store.remove(current.imagePath); drafts.removeAll{$0.id == current.id}; message="Drink published."
    } catch { current.state = .failed; current.lastError = error.localizedDescription; try? await persist(current); message="Couldn’t publish. Your draft is safe; tap Retry." }
  }
  public func retryAll(apiURL:String) async { for draft in drafts where draft.state == .local || draft.state == .failed { await publish(draft,apiURL:apiURL) } }
  public func discard(_ draft: Draft) async {
    guard !working else { return }
    do { try await outbox.remove(draft); try? await store.remove(draft.imagePath); drafts.removeAll { $0.id == draft.id }; message="Draft discarded." }
    catch { message=error.localizedDescription }
  }
  private func persist(_ draft:Draft) async throws { try await outbox.save(draft); if let index=drafts.firstIndex(where:{$0.id==draft.id}) { drafts[index]=draft } else { drafts.append(draft) } }
}
