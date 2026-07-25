//
//  EVYAPIManager.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

let API_HOST = "localhost:8000"
let AUTH_TOKEN = "Geo"

actor EVYAPIManager {
  private let rpcWS: any EVYRPCTransport
  private var authed: Bool = false
  private var installedDisconnectHandler = false
  private var reconnectTask: Task<Void, Never>?
  private var didSurfaceDisconnect = false

  /// Base delay for the reconnect backoff; overridable so tests do not wait seconds.
  var reconnectBaseDelayNanos: UInt64 = 1_000_000_000
  private let reconnectMaxDelayNanos: UInt64 = 30_000_000_000

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

  /// Test seam: lets suites drive the session lifecycle without a live socket.
  init(transport: any EVYRPCTransport) {
    self.rpcWS = transport
  }

  func setReconnectBaseDelayNanos(_ nanos: UInt64) {
    reconnectBaseDelayNanos = nanos
  }

  /// Performs the login + subscribe handshake unless we already hold a live,
  /// authenticated session. Auth state alone is not enough: the socket can drop
  /// underneath us, and a stale `authed` would strand every later request.
  private func validateAuth() async throws {
    await installDisconnectHandlerIfNeeded()

    if authed, await rpcWS.isConnected { return }
    authed = false

    let token = ProcessInfo.processInfo.environment["AUTH_TOKEN"] ?? AUTH_TOKEN
    let connected = try await rpcWS.connect(token: token, os: DataOS.ios)

    let result = try await rpcWS.subscribe(event: "dataChanged")
    if result["dataChanged"] != "ok" {
      throw EVYRPCError.subscriptionError("Failed to subscribe to dataChanged events")
    }

    authed = connected
    if connected {
      didSurfaceDisconnect = false
      reconnectTask?.cancel()
      reconnectTask = nil
    }
  }

  private func installDisconnectHandlerIfNeeded() async {
    guard !installedDisconnectHandler else { return }
    installedDisconnectHandler = true
    await rpcWS.setDisconnectHandler { [weak self] in
      await self?.handleTransportDisconnected()
    }
  }

  private func handleTransportDisconnected() {
    authed = false
    // Only the first drop is worth an alert; reconnect attempts stay quiet.
    if !didSurfaceDisconnect {
      didSurfaceDisconnect = true
      postError(EVYError.websocketError(context: "WebSocket disconnected"))
    }
    scheduleReconnect()
  }

  /// Re-establishes the session in the background so `dataChanged` pushes resume
  /// without waiting for the user to trigger a request.
  private func scheduleReconnect() {
    guard reconnectTask == nil else { return }
    reconnectTask = Task { [weak self] in
      guard let self else { return }
      var delay = await self.reconnectBaseDelayNanos
      let maxDelay = await self.reconnectMaxDelayNanos
      while !Task.isCancelled {
        try? await Task.sleep(nanoseconds: delay)
        if Task.isCancelled { return }
        if await self.attemptReconnect() { return }
        delay = min(delay * 2, maxDelay)
      }
    }
  }

  private func attemptReconnect() async -> Bool {
    do {
      try await validateAuth()
      return authed
    } catch {
      return false
    }
  }

  nonisolated private func postError(_ error: Error) {
    Task { @MainActor in
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
    }
  }
}
