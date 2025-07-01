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

    let title = asset.commonMetadata.first(where: { $0.commonKey?.rawValue == "title" })?.stringValue
    let artist = asset.commonMetadata.first(where: { $0.commonKey?.rawValue == "artist" })?.stringValue
    let album = asset.commonMetadata.first(where: { $0.commonKey?.rawValue == "albumName" })?.stringValue
    let duration = CMTimeGetSeconds(asset.duration)

    metadata["title"] = title
    metadata["artist"] = artist
    metadata["albumName"] = album
    metadata["duration"] = duration

    // Extract artwork if available
    if let artworkItem = asset.commonMetadata.first(where: { $0.commonKey?.rawValue == "artwork" }),
       let data = artworkItem.dataValue {
      let format = artworkItem.value(forKey: "dataType") as? String
      let mimeType = format?.contains("jpeg") == true ? "image/jpeg" : "image/png"
      let base64 = data.base64EncodedString()
      metadata["artwork"] = "data:\(mimeType);base64,\(base64)"
    }

    // 🧠 Extract track number from AVMetadataKeySpace.id3 or .iTunes
    let trackNumberItem = asset.metadata.first(where: {
      ($0.identifier?.rawValue.contains("trackNumber") ?? false)
        || ($0.commonKey?.rawValue == "trackNumber")
    })

    if let trackNumberValue = trackNumberItem?.numberValue {
      metadata["trackNumber"] = trackNumberValue.intValue
    } else if let stringVal = trackNumberItem?.stringValue,
              let parsed = Int(stringVal.components(separatedBy: "/").first ?? "") {
      metadata["trackNumber"] = parsed
    }
    
    let discNumberItem = asset.metadata.first(where: {
      ($0.identifier?.rawValue.contains("discNumber") ?? false)
        || ($0.commonKey?.rawValue == "discNumber")
    })

    if let discNumberValue = discNumberItem?.numberValue {
      metadata["discNumber"] = discNumberValue.intValue
    } else if let stringVal = discNumberItem?.stringValue,
              let parsed = Int(stringVal.components(separatedBy: "/").first ?? "") {
      metadata["discNumber"] = parsed
    }

    resolve(metadata)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
