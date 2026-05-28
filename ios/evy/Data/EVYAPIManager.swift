//
//  EVYAPIManager.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

let API_HOST = "localhost:8000"

actor EVYAPIManager {
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
    let frames = try imageData.uploadFrames(uploadId: uploadId, mimeType: mimeType)
    do {
      for frame in frames {
        try await rpcWS.sendBinary(frame)
      }
      let createdAt = Self.iso8601Now()
      let response: EVYCreateImageData = try await rpcWS.fetch(
        method: "create",
        params: EVYCreateImageParams(
          service: "evy",
          resource: "images",
          filter: EVYCreateImageParams.Filter(id: uploadId),
          data: EVYCreateImageData(
            id: uploadId,
            type: mimeType,
            createdAt: createdAt,
            updatedAt: createdAt
          )
        ),
        expecting: EVYCreateImageData.self
      )
      return response.id
    } catch {
      try? await rpcWS.fetch(
        method: "cancelUpload",
        params: EVYCancelUploadParams(uploadId: uploadId),
        expecting: EVYCancelUploadResponse.self
      )
      throw error
    }
  }

  private static func iso8601Now() -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: Date())
  }

  public func getImage(id: String) async throws -> EVYGetImageItem {
    try await validateAuth()
    let items = try await rpcWS.fetch(
      method: "get",
      params: EVYGetImagesParams(
        service: "evy",
        resource: "images",
        filter: EVYGetImagesParams.Filter(id: id)
      ),
      expecting: [EVYGetImageItem].self
    )
    guard let item = items.first else {
      throw EVYError.imageLoadFailed(name: id)
    }
    return item
  }

  public func deleteImage(id: String) async throws {
    try await validateAuth()
    _ = try await rpcWS.fetch(
      method: "delete",
      params: EVYDeleteImageParams(
        service: "evy",
        resource: "images",
        filter: EVYDeleteImageParams.Filter(id: id)
      ),
      expecting: EVYCreateImageData.self
    )
  }

  private init() {
    let host = ProcessInfo.processInfo.environment["API_HOST"] ?? API_HOST
    self.rpcWS = EVYWebsocket(host: host)
  }

  private func validateAuth() async throws {
    if authed { return }

    let connected = try await rpcWS.connect(token: "Geo", os: DataOS.ios)

    let result = try await rpcWS.subscribe(event: "dataChanged")
    if result["dataChanged"] != "ok" {
      throw EVYRPCError.subscriptionError("Failed to subscribe to dataChanged events")
    }

    authed = connected
  }
}
