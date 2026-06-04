//
//  EVYStateTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYStateTests: XCTestCase {

  private func makeCountingState(
    watches: [String]
  ) -> (state: EVYState<Int>, getCallCount: () -> Int) {
    var callCount = 0
    let state = EVYState<Int>(
      watches: watches,
      setter: {
        callCount += 1
        return callCount
      })
    return (state, { callCount })
  }

  private func postDataChange(_ key: String?) {
    NotificationCenter.default.post(name: .evyDataChanged, object: key)
  }

  func testInitialValueComputedAtInit() {
    let state = EVYState<Int>(watches: ["{counter}"], setter: { 42 })
    XCTAssertEqual(state.value, 42)
  }

  func testFirstWatchMatchTriggersRecompute() {
    var callCount = 0
    let state = EVYState<Int>(
      watches: ["{watch1}", "{watch2}"],
      setter: {
        callCount += 1
        return callCount
      })
    XCTAssertEqual(callCount, 1)

    postDataChange("watch1")

    XCTAssertEqual(callCount, 2)
    XCTAssertEqual(state.value, 2)
  }

  func testSecondWatchMatchTriggersRecompute() {
    var callCount = 0
    let state = EVYState<Int>(
      watches: ["{watch1}", "{watch2}"],
      setter: {
        callCount += 1
        return callCount
      })
    XCTAssertEqual(callCount, 1)

    postDataChange("watch2")

    XCTAssertEqual(callCount, 2)
    XCTAssertEqual(state.value, 2)
  }

  func testUnrelatedNotificationDoesNotTriggerRecompute() {
    var callCount = 0
    let state = EVYState<Int>(
      watches: ["{watch1}", "{watch2}"],
      setter: {
        callCount += 1
        return callCount
      })
    XCTAssertEqual(callCount, 1)

    postDataChange("unrelated")

    XCTAssertEqual(callCount, 1)
    XCTAssertEqual(state.value, 1)
  }

  func testBroadcastNotificationWithNoKeyTriggersRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{watch1}"])
    XCTAssertEqual(getCallCount(), 1)

    postDataChange(nil)

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testEmptyWatchesIgnoresKeyedNotifications() {
    let (state, getCallCount) = makeCountingState(watches: [])
    XCTAssertEqual(getCallCount(), 1)

    postDataChange("anything")
    XCTAssertEqual(getCallCount(), 1)
    XCTAssertEqual(state.value, 1)

    postDataChange(nil)
    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testExactSourceNotificationTriggersRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{pickup_selection}"])
    XCTAssertEqual(getCallCount(), 1)

    postDataChange("pickup_selection")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testUnrelatedSourceNotificationDoesNotTriggerRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{pickup_selection}"])
    XCTAssertEqual(getCallCount(), 1)

    postDataChange("conditions")

    XCTAssertEqual(getCallCount(), 1)
    XCTAssertEqual(state.value, 1)
  }

  func testEntityQualifiedNotificationTriggersRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{item.pickup_selection}"])
    XCTAssertEqual(getCallCount(), 1)

    postDataChange("item.pickup_selection")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testNestedChildNotificationTriggersParentWatchRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{item.pickup_selection}"])
    XCTAssertEqual(getCallCount(), 1)

    postDataChange("item.pickup_selection.start")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testParentNotificationTriggersNestedChildWatchRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{item.pickup_selection.start}"])
    XCTAssertEqual(getCallCount(), 1)

    postDataChange("item.pickup_selection")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testEmptyWatchIgnoresKeyedNotifications() {
    let (state, getCallCount) = makeCountingState(watches: [""])
    XCTAssertEqual(getCallCount(), 1)

    postDataChange("conditions")

    XCTAssertEqual(getCallCount(), 1)
    XCTAssertEqual(state.value, 1)
  }
}
