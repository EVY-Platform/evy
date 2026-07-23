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

  private func postValueChange(_ key: String?) {
    NotificationCenter.default.post(name: .evyValueChanged, object: key)
  }

  func testInitialValueComputedAtInit() {
    let state = EVYState<Int>(watches: ["{counter}"], setter: { 42 })
    XCTAssertEqual(state.value, 42)
  }

  func testWatchMatchAtEitherIndexTriggersRecompute() {
    var callCount = 0
    let state = EVYState<Int>(
      watches: ["{watch1}", "{watch2}"],
      setter: {
        callCount += 1
        return callCount
      })
    XCTAssertEqual(callCount, 1)

    postValueChange("watch1")
    XCTAssertEqual(callCount, 2)
    XCTAssertEqual(state.value, 2)

    postValueChange("watch2")
    XCTAssertEqual(callCount, 3)
    XCTAssertEqual(state.value, 3)
  }

  func testUnrelatedNotificationDoesNotTriggerRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{watch1}", "{watch2}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange("unrelated")

    XCTAssertEqual(getCallCount(), 1)
    XCTAssertEqual(state.value, 1)
  }

  func testBroadcastNotificationWithNoKeyTriggersRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{watch1}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange(nil)

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testEmptyWatchesIgnoresKeyedNotifications() {
    let (emptyListState, emptyListCallCount) = makeCountingState(watches: [])
    XCTAssertEqual(emptyListCallCount(), 1)
    postValueChange("anything")
    XCTAssertEqual(emptyListCallCount(), 1)
    XCTAssertEqual(emptyListState.value, 1)
    postValueChange(nil)
    XCTAssertEqual(emptyListCallCount(), 1)

    let (emptyStringState, emptyStringCallCount) = makeCountingState(watches: [""])
    XCTAssertEqual(emptyStringCallCount(), 1)
    postValueChange("conditions")
    XCTAssertEqual(emptyStringCallCount(), 1)
    XCTAssertEqual(emptyStringState.value, 1)
  }

  func testExactSourceNotificationTriggersRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{pickup_selection}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange("pickup_selection")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testResourceNotificationTriggersCollectionWatchRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{items}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange("items")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testUnrelatedSourceNotificationDoesNotTriggerRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{pickup_selection}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange("conditions")

    XCTAssertEqual(getCallCount(), 1)
    XCTAssertEqual(state.value, 1)
  }

  func testEntityQualifiedNotificationTriggersRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{item.pickup_selection}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange("item.pickup_selection")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testNestedChildNotificationTriggersParentWatchRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{item.pickup_selection}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange("item.pickup_selection.start")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testParentNotificationTriggersNestedChildWatchRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{item.pickup_selection.start}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange("item.pickup_selection")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }

  func testDraftAliasPathNotificationTriggersRecompute() {
    let (state, getCallCount) = makeCountingState(watches: ["{condition}"])
    XCTAssertEqual(getCallCount(), 1)

    postValueChange("condition")

    XCTAssertEqual(getCallCount(), 2)
    XCTAssertEqual(state.value, 2)
  }
}
