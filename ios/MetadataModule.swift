import AVFoundation
import Foundation
import React

@objc(MetadataModule)
class MetadataModule: NSObject {

  @objc
  func getMetadata(
    _ path: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock
  ) {
    let url = URL(fileURLWithPath: path)
    let asset = AVAsset(url: url)
    var metadata: [String: Any] = [:]

    print("=== Metadata Item ===")
    dump(asset)

    let title = asset.commonMetadata.first(where: { $0.commonKey?.rawValue == "title" })?
      .stringValue
    let artist = asset.commonMetadata.first(where: { $0.commonKey?.rawValue == "artist" })?
      .stringValue
    let album = asset.commonMetadata.first(where: { $0.commonKey?.rawValue == "albumName" })?
      .stringValue
    let duration = CMTimeGetSeconds(asset.duration)

    metadata["title"] = title
    metadata["artist"] = artist
    metadata["albumName"] = album
    metadata["duration"] = duration

    // Extract artwork (image) if available
    let artworkItem = asset.commonMetadata.first(where: { $0.commonKey?.rawValue == "artwork" })
    if let data = artworkItem?.dataValue {
      let format = artworkItem?.value(forKey: "dataType") as? String
      let mimeType = format?.contains("jpeg") == true ? "image/jpeg" : "image/png"
      let base64 = data.base64EncodedString()
      metadata["artwork"] = "data:\(mimeType);base64,\(base64)"
    }

    resolve(metadata)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
