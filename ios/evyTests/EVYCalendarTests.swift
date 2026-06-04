//
//  EVYCalendarTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYCalendarTests: XCTestCase {
  private let headerFormat = "{formatDatetime($datum, \"EEE d\")}"
  private let timeslotFormat = "{formatDatetime($datum, \"H:mm\")}"

  private func todayPlus(_ days: Int) -> String {
    let date = Calendar.current.date(byAdding: .day, value: days, to: Date())!
    return date.formatted(.iso8601.year().month().day())
  }

  func testSlotCountFor12HourRangeAt30MinIntervals() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "07:00",
      endTime: "19:00",
      intervalMinutes: 30,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: [],
      secondarySelections: []
    )
    XCTAssertEqual(slots.count, 7 * 24)
  }

  func testStaleSelectionsAppearAsExtraColumns() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "09:00",
      endTime: "11:00",
      intervalMinutes: 60,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: [],
      secondarySelections: [
        "2026-05-20T09:00:00",
        "2026-05-21T09:00:00",
        "2026-05-22T10:00:00",
      ]
    )
    let columns = Set(slots.map { $0.x }).count
    XCTAssertEqual(columns, 10)
  }

  func testTimeLabelAppearsEveryLabelInterval() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "07:00",
      endTime: "09:00",
      intervalMinutes: 30,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: ["2026-05-20T07:00:00"],
      secondarySelections: []
    )
    let labelledSlots = slots.filter { $0.x == 0 && !$0.timeLabel.isEmpty }
    XCTAssertEqual(labelledSlots.map { $0.timeLabel }, ["7:00", "8:00"])
  }

  func testTimeLabelFormattedWithTimeslotFormatExpression() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "09:00",
      endTime: "11:00",
      intervalMinutes: 60,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: "{formatDatetime($datum, \"h:mm a\")}",
      primarySelections: ["2026-05-20T09:00:00"],
      secondarySelections: []
    )
    let labelledSlots = slots.filter { $0.x == 0 && !$0.timeLabel.isEmpty }
    XCTAssertEqual(labelledSlots.map { $0.timeLabel }, ["9:00 AM", "10:00 AM"])
  }

  func testPrimarySelectionIsDetectedCorrectly() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "09:00",
      endTime: "11:00",
      intervalMinutes: 60,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: ["2026-06-03T09:00:00"],
      secondarySelections: []
    )
    let selected = slots.filter { $0.isPrimarySelected }
    XCTAssertEqual(selected.count, 1)
    XCTAssertEqual(selected.first?.dateTimeISO, "2026-06-03T09:00:00")
  }

  func testSecondarySelectionIsDetectedCorrectly() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "09:00",
      endTime: "11:00",
      intervalMinutes: 60,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: [],
      secondarySelections: ["2026-06-03T10:00:00"]
    )
    let secondarySelected = slots.filter { $0.isSecondarySelected }
    XCTAssertEqual(secondarySelected.count, 1)
    XCTAssertEqual(secondarySelected.first?.dateTimeISO, "2026-06-03T10:00:00")
    XCTAssertFalse(secondarySelected.first!.isPrimarySelected)
  }

  func testHeaderFormattingForKnownDate() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "09:00",
      endTime: "10:00",
      intervalMinutes: 60,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: ["2026-06-03T09:00:00"],
      secondarySelections: []
    )
    XCTAssertEqual(slots.first?.header, "Wed 3")
  }

  func testInvalidTimeRangeProducesZeroSlots() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "10:00",
      endTime: "09:00",
      intervalMinutes: 30,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: [],
      secondarySelections: []
    )
    XCTAssertEqual(slots.count, 0)
  }

  func testZeroIntervalReturnsEmpty() {
    let slots = EVYDatetime.buildCalendarSlots(
      startTime: "07:00",
      endTime: "19:00",
      intervalMinutes: 0,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: ["2026-06-03T09:00:00"],
      secondarySelections: []
    )
    XCTAssertTrue(slots.isEmpty)
  }

  func testColumnCountIsStableWhenPrimarySelectionChanges() {
    let baselineSlots = EVYDatetime.buildCalendarSlots(
      startTime: "09:00",
      endTime: "10:00",
      intervalMinutes: 60,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: [],
      secondarySelections: []
    )
    let baselineColumns = Set(baselineSlots.map { $0.x }).count

    let afterSelect = EVYDatetime.buildCalendarSlots(
      startTime: "09:00",
      endTime: "10:00",
      intervalMinutes: 60,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: ["\(todayPlus(2))T09:00:00"],
      secondarySelections: []
    )
    let afterColumns = Set(afterSelect.map { $0.x }).count

    XCTAssertEqual(baselineColumns, 7)
    XCTAssertEqual(afterColumns, 7)
  }

  func testColumnCountIsStableWhenSecondarySelectionChanges() {
    let withinWindow = EVYDatetime.buildCalendarSlots(
      startTime: "09:00",
      endTime: "10:00",
      intervalMinutes: 60,
      labelIntervalMinutes: 60,
      headerFormat: headerFormat,
      timeslotFormat: timeslotFormat,
      primarySelections: [],
      secondarySelections: ["\(todayPlus(3))T09:00:00"]
    )
    let columns = Set(withinWindow.map { $0.x }).count
    XCTAssertEqual(columns, 7)
  }

}
