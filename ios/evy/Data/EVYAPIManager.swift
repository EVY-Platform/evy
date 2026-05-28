//
//  EVYAPIManager.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

let API_HOST = "localhost:8000"

final class EVYAPIManager {
  private let rpcWS: EVYWebsocketProtocol
  private var authed: Bool = false

  static let shared = EVYAPIManager()

  public func fetch<T: Codable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T {
    try await validateAuth()
    return try await rpcWS.fetch(method: method, params: params, expecting: T.self)
  }

  public func uploadImage(_ imageData: Data, mimeType: String) async throws -> String {
    try await validateAuth()
    let uploadId = UUID().uuidString
    let frames = try imageData.imageUploadFrames(uploadId: uploadId, mimeType: mimeType)
    do {
      for frame in frames {
        try await rpcWS.sendBinary(frame)
      }
      let response: EVYCompleteImageUploadResponse = try await rpcWS.fetch(
        method: "completeImageUpload",
        params: EVYCompleteImageUploadParams(
          uploadId: uploadId,
          type: mimeType,
          totalBytes: imageData.count,
          chunkCount: frames.count
        ),
        expecting: EVYCompleteImageUploadResponse.self
      )
      return response.id
    } catch {
      try? await rpcWS.fetch(
        method: "cancelImageUpload",
        params: EVYCancelImageUploadParams(uploadId: uploadId),
        expecting: EVYCancelImageUploadResponse.self
      )
      throw error
    }
  }

  public func getImage(id: String) async throws -> EVYImageGetResponse {
    try await validateAuth()
    return try await rpcWS.fetch(
      method: "getImage",
      params: EVYImageGetParams(id: id),
      expecting: EVYImageGetResponse.self
    )
  }

  public func deleteImage(id: String) async throws {
    try await validateAuth()
    _ = try await rpcWS.fetch(
      method: "deleteImage",
      params: EVYImageDeleteParams(id: id),
      expecting: EVYImageDeleteResponse.self
    )
  }

  private init() {
    let host = ProcessInfo.processInfo.environment["API_HOST"] ?? API_HOST
    self.rpcWS = EVYWebsocket(host: host)
  }

  private func validateAuth() async throws {
    if authed { return }

    authed = try await rpcWS.connect(token: "Geo", os: DataOS.ios)

    let result = try await rpcWS.subscribe(event: "dataChanged")
    if result["dataChanged"] != "ok" {
      throw EVYRPCError.subscriptionError("Failed to subscribe to dataChanged events")
    }
  }
}
