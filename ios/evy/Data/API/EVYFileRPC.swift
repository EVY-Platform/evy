//
//  EVYFileRPC.swift
//  evy
//

import Foundation

typealias EVYCreateFileParams = CreateFileParams
typealias EVYCreateFileData = FileMetadataClass
typealias EVYCancelUploadParams = CancelUploadParams
typealias EVYCancelUploadResponse = CancelUploadResponse
typealias EVYGetFilesParams = GetFilesParams
typealias EVYGetFileItem = FileWithBinaryClass
typealias EVYDeleteFileParams = DeleteFileParams

private let chunkSize = 256 * 1024

extension Data {
  func uploadFrames(uploadId: String) throws -> [Data] {
    var frames: [Data] = []
    var offset = 0
    var index = 0
    while offset < count {
      let end = Swift.min(offset + chunkSize, count)
      let chunkData = self[offset..<end]
      let metadata = FileUploadChunkMetadataClass(
        byteLength: chunkData.count,
        byteOffset: offset,
        index: index,
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
