//
//  EVYAPIManagerReconnectTests.swift
//  evyTests
//

import XCTest

@testable import evy

/// Stand-in for `EVYWebsocket` that lets tests drive connect / drop cycles.
actor FakeRPCTransport: EVYRPCTransport {
  private(set) var connectCount = 0
  private(set) var subscribeCount = 0
  private(set) var fetchCount = 0
  private var connected = false
  private var connectShouldFail = false
  private var disconnectHandler: (@Sendable () async -> Void)?

  var isConnected: Bool { connected }

  func setDisconnectHandler(_ handler: (@Sendable () async -> Void)?) {
    disconnectHandler = handler
  }

  func connect(token: String, os: DataOS) async throws -> Bool {
    connectCount += 1
    if connectShouldFail {
      throw EVYRPCError.connectionError("refused")
    }
    connected = true
    return true
  }

  func subscribe(event: String) async throws -> [String: String] {
    subscribeCount += 1
    return [event: "ok"]
  }

  func fetch<T: Codable & Sendable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T {
    guard connected else {
      throw EVYRPCError.connectionError("Not connected")
    }
    fetchCount += 1
    if T.self == Bool.self {
      return true as! T
    }
    let empty = try JSONSerialization.data(withJSONObject: [String: String]())
    return try JSONDecoder().decode(T.self, from: empty)
  }

  func sendBinary(_ data: Data) async throws {}

  // MARK: - Test controls

  func setConnectShouldFail(_ value: Bool) {
    connectShouldFail = value
  }

  /// Mimics the socket dropping underneath the manager.
  func simulateDisconnect() async {
    connected = false
    await disconnectHandler?()
  }

  /// Mimics a socket that is gone without the close callback ever firing.
  func simulateSilentDisconnect() {
    connected = false
  }
}

final class EVYAPIManagerReconnectTests: XCTestCase {

  func testFirstRequestPerformsHandshakeOnce() async throws {
    let transport = FakeRPCTransport()
    let manager = EVYAPIManager(transport: transport)

    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)
    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)

    let connects = await transport.connectCount
    let subscribes = await transport.subscribeCount
    XCTAssertEqual(connects, 1, "second request should reuse the live session")
    XCTAssertEqual(subscribes, 1)
  }

  /// The regression: a dropped socket used to leave `authed == true`, so every
  /// later request failed with "Not connected" until the app was relaunched.
  func testRequestAfterDisconnectReconnectsInsteadOfFailing() async throws {
    let transport = FakeRPCTransport()
    let manager = EVYAPIManager(transport: transport)
    await manager.setReconnectBaseDelayNanos(60_000_000_000)  // keep background retry out of the way

    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)
    await transport.simulateDisconnect()

    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)

    let connects = await transport.connectCount
    XCTAssertEqual(connects, 2, "dropped socket should trigger a fresh handshake")
  }

  /// The second defense: if the close callback never arrives, stale `authed`
  /// must not be trusted on its own — the live connection state decides.
  func testRequestAfterSilentDropReconnects() async throws {
    let transport = FakeRPCTransport()
    let manager = EVYAPIManager(transport: transport)
    await manager.setReconnectBaseDelayNanos(60_000_000_000)

    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)
    await transport.simulateSilentDisconnect()

    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)

    let connects = await transport.connectCount
    XCTAssertEqual(connects, 2, "a silently dropped socket should still be re-established")
  }

  func testReconnectResubscribesToDataChanged() async throws {
    let transport = FakeRPCTransport()
    let manager = EVYAPIManager(transport: transport)
    await manager.setReconnectBaseDelayNanos(60_000_000_000)

    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)
    await transport.simulateDisconnect()
    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)

    let subscribes = await transport.subscribeCount
    XCTAssertEqual(subscribes, 2, "push subscription must be re-established after a drop")
  }

  func testBackgroundReconnectRestoresSessionWithoutARequest() async throws {
    let transport = FakeRPCTransport()
    let manager = EVYAPIManager(transport: transport)
    await manager.setReconnectBaseDelayNanos(10_000_000)  // 10ms

    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)
    await transport.simulateDisconnect()

    // No further requests: the backoff loop alone should bring the session back.
    var reconnected = false
    for _ in 0..<100 {
      try await Task.sleep(nanoseconds: 20_000_000)
      if await transport.isConnected {
        reconnected = true
        break
      }
    }

    XCTAssertTrue(reconnected, "background reconnect should re-establish the session")
  }

  func testBackgroundReconnectRetriesWhileServerIsDown() async throws {
    let transport = FakeRPCTransport()
    let manager = EVYAPIManager(transport: transport)
    await manager.setReconnectBaseDelayNanos(10_000_000)

    _ = try await manager.fetch(method: "get", params: ["a": "b"], expecting: Bool.self)
    await transport.setConnectShouldFail(true)
    await transport.simulateDisconnect()

    // Let a few backoff attempts elapse, then let the "server" come back.
    try await Task.sleep(nanoseconds: 100_000_000)
    let attemptsWhileDown = await transport.connectCount
    XCTAssertGreaterThan(attemptsWhileDown, 1, "should keep retrying while refused")

    await transport.setConnectShouldFail(false)

    var recovered = false
    for _ in 0..<100 {
      try await Task.sleep(nanoseconds: 20_000_000)
      if await transport.isConnected {
        recovered = true
        break
      }
    }
    XCTAssertTrue(recovered, "session should recover once the server accepts again")
  }
}
