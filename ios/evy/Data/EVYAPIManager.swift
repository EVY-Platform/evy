//
//  EVYAPIManager.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

let API_HOST = "127.0.0.1:8000"
let AUTH_TOKEN = "Geo"

actor EVYAPIManager {
  private let rpcWS: EVYWebsocket
  private var authed: Bool = false

  static let shared = EVYAPIManager()

  func fetch<T: Codable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T {
    try await validateAuth()
    return try await rpcWS.fetch(method: method, params: params, expecting: T.self)
  }

  func uploadFile(_ fileData: Data) async throws -> String {
    try await validateAuth()
    let uploadId = UUID().uuidString
    let frames = try fileData.uploadFrames(uploadId: uploadId)
    do {
      for frame in frames {
        try await rpcWS.sendBinary(frame)
      }
      let createdAt = await MainActor.run { EVY.nowISO8601(fractional: true) }
      let response: EVYCreateFileData = try await rpcWS.fetch(
        method: "create",
        params: EVYCreateFileParams(
          data: EVYCreateFileData(
            createdAt: createdAt,
            id: uploadId,
            type: "image/jpeg",
            updatedAt: createdAt
          ),
          filter: CreateFileParamsFilter(id: uploadId),
          resource: .files,
          service: EVY_CORE_SERVICE
        ),
        expecting: EVYCreateFileData.self
      )
      return response.id
    } catch {
      _ = try? await rpcWS.fetch(
        method: "cancelUpload",
        params: EVYCancelUploadParams(uploadID: uploadId),
        expecting: EVYCancelUploadResponse.self
      )
      throw error
    }
  }

  func getFile(id: String) async throws -> EVYGetFileItem {
    try await validateAuth()
    let items = try await rpcWS.fetch(
      method: "get",
      params: EVYGetFilesParams(
        filter: GetFilesParamsFilter(id: id, updatedAfter: nil),
        resource: .files,
        service: EVY_CORE_SERVICE
      ),
      expecting: [EVYGetFileItem].self
    )
    guard let item = items.first else {
      throw EVYError.imageLoadFailed(name: id)
    }
    return item
  }

  func deleteFile(id: String) async throws {
    try await validateAuth()
    _ = try await rpcWS.fetch(
      method: "delete",
      params: EVYDeleteFileParams(
        filter: CreateFileParamsFilter(id: id),
        resource: .files,
        service: EVY_CORE_SERVICE
      ),
      expecting: EVYCreateFileData.self
    )
  }

  private init() {
    let host = ProcessInfo.processInfo.environment["API_HOST"] ?? API_HOST
    self.rpcWS = EVYWebsocket(host: host)
  }

  private func validateAuth() async throws {
    if authed { return }

    let token = ProcessInfo.processInfo.environment["AUTH_TOKEN"] ?? AUTH_TOKEN
    let connected = try await rpcWS.connect(token: token, os: DataOS.ios)

    let result = try await rpcWS.subscribe(event: "dataChanged")
    if result["dataChanged"] != "ok" {
      throw EVYRPCError.subscriptionError("Failed to subscribe to dataChanged events")
    }

    authed = connected
  }
}
