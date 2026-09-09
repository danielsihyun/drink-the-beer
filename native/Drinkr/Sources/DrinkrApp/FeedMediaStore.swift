#if canImport(SwiftUI)
import Foundation
import ImageIO
import Observation
import SwiftUI
#if canImport(UIKit)
import UIKit
typealias FeedPlatformImage = UIImage
#else
import AppKit
typealias FeedPlatformImage = NSImage
#endif

/// Feed-scoped image pipeline. A feed cell may be recreated many times while
/// scrolling, but its private signed URL and decoded thumbnail must not be.
@MainActor @Observable final class FeedMediaStore {
  private(set) var images: [UUID: FeedPlatformImage] = [:]
  private(set) var failedAssets: Set<UUID> = []
  private var loadingAssets: Set<UUID> = []
  private var insertionOrder: [UUID] = []
  private let capacity = 24

  func image(for assetID: UUID) -> FeedPlatformImage? { images[assetID] }
  func failed(_ assetID: UUID) -> Bool { failedAssets.contains(assetID) }

  func load(assetID: UUID, client: APIClient) async {
    guard images[assetID] == nil, !loadingAssets.contains(assetID) else { return }
    loadingAssets.insert(assetID)
    failedAssets.remove(assetID)
    defer { loadingAssets.remove(assetID) }

    do {
      let signedURL = try await client.mediaURL(assetID)
      let (data, response) = try await URLSession.shared.data(from: signedURL)
      guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode,
            let image = downsample(data) else { throw AppError.server("Photo could not be loaded.") }
      images[assetID] = image
      insertionOrder.removeAll { $0 == assetID }
      insertionOrder.append(assetID)
      while insertionOrder.count > capacity {
        images.removeValue(forKey: insertionOrder.removeFirst())
      }
    } catch {
      failedAssets.insert(assetID)
    }
  }

  private func downsample(_ data: Data) -> FeedPlatformImage? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: 1_200
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
    #if canImport(UIKit)
    return UIImage(cgImage: image)
    #else
    return NSImage(cgImage: image, size: .zero)
    #endif
  }
}
#endif
