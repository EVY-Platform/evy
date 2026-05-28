//
//  EVYImageRPC.swift
//  evy
//

import Foundation

struct EVYImageUploadChunkMetadata: Encodable {
  let type: String
  let uploadId: String
  let index: Int
  let byteOffset: Int
  let byteLength: Int
}

struct EVYCompleteImageUploadParams: Encodable {
  let uploadId: String
  let type: String
  let totalBytes: Int
  let chunkCount: Int
}

struct EVYCompleteImageUploadResponse: Codable {
  let id: String
  let type: String
  let createdAt: String
}

struct EVYCancelImageUploadParams: Encodable {
  let uploadId: String
}

struct EVYCancelImageUploadResponse: Codable {
  let ok: Bool
}

struct EVYImageGetParams: Encodable {
  let id: String
}

struct EVYImageGetResponse: Codable {
  let id: String
  let type: String
  let createdAt: String
  let dataBase64: String
}

struct EVYImageDeleteParams: Encodable {
  let id: String
}

struct EVYImageDeleteResponse: Codable {
  let ok: Bool
}

// MARK: - Binary frame encoding

private let chunkSize = 256 * 1024  // 256 KB per chunk

extension Data {
  func imageUploadFrames(uploadId: String, mimeType: String) throws -> [Data] {
    var frames: [Data] = []
    var offset = 0
    var index = 0
    while offset < count {
      let end = Swift.min(offset + chunkSize, count)
      let chunkData = self[offset..<end]
      let metadata = EVYImageUploadChunkMetadata(
        type: mimeType,
        uploadId: uploadId,
        index: index,
        byteOffset: offset,
        byteLength: chunkData.count
      )
      let metadataJSON = try JSONEncoder().encode(metadata)
      var frame = Data()
      var lengthBigEndian = UInt32(metadataJSON.count).bigEndian
      frame.append(contentsOf: Swift.withUnsafeBytes(of: &lengthBigEndian) { Array($0) })
      frame.append(metadataJSON)
      frame.append(contentsOf: chunkData)
      frames.append(frame)
      offset = end
      index += 1
    }
    return frames
  }
}
