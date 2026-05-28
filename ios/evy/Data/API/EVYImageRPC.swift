//
//  EVYImageRPC.swift
//  evy
//

import Foundation

typealias EVYCreateImageParams = CreateImageParams
typealias EVYCreateImageData = ImageMetadataClass
typealias EVYCancelUploadParams = CancelUploadParams
typealias EVYCancelUploadResponse = CancelUploadResponse
typealias EVYGetImagesParams = GetImagesParams
typealias EVYGetImageItem = ImageWithBinaryClass
typealias EVYDeleteImageParams = DeleteImageParams

// MARK: - Binary frame encoding

private let chunkSize = 256 * 1024  // 256 KB per chunk

extension Data {
  func uploadFrames(uploadId: String, mimeType: String) throws -> [Data] {
    guard let imageType = TypeEnum(rawValue: mimeType) else {
      throw EVYError.invalidData(context: "Unsupported image type: \(mimeType)")
    }

    var frames: [Data] = []
    var offset = 0
    var index = 0
    while offset < count {
      let end = Swift.min(offset + chunkSize, count)
      let chunkData = self[offset..<end]
      let metadata = ImageUploadChunkMetadataClass(
        byteLength: chunkData.count,
        byteOffset: offset,
        index: index,
        type: imageType,
        uploadID: uploadId
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
