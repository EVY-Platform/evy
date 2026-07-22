//
//  EVYCalendarTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYCalendarTests: XCTestCase {
  private let headerFormat = "EEE d"
  private let timeslotFormat = "H:mm"

  private func todayPlus(_ days: Int) -> String {
    let date = Calendar.current.date(byAdding: .day, value: days, to: Date())!
    return date.formatted(.iso8601.year().month().day())
  }

  private func calendarRow(
    startTime: String = "07:00",
    endTime: String = "19:00",
    timeslotIntervalMinutes: String = "30",
    labelIntervalMinutes: String = "60",
    headerFormat: String? = nil,
    timeslotFormat: String? = nil
  ) -> CalendarRowViewData {
    let jsonObject: [String: Any] = [
      "title": "",
      "source": "pickup_selection",
      "destination": "pickup_selection",
      "start_time": startTime,
      "end_time": endTime,
      "timeslot_interval_minutes": timeslotIntervalMinutes,
      "label_interval_minutes": labelIntervalMinutes,
      "header_format": headerFormat ?? self.headerFormat,
      "timeslot_format": timeslotFormat ?? self.timeslotFormat,
    ]
    let data = try! JSONSerialization.data(withJSONObject: jsonObject)
    return try! JSONDecoder().decode(CalendarRowViewData.self, from: data)
  }

  func testSlotCountFor12HourRangeAt30MinIntervals() {
    let slots = EVYDatetime.buildCalendarSlots(
      row: calendarRow(),
      primarySelections: [],
      secondarySelections: []
    )
    XCTAssertEqual(slots.count, 7 * 24)
  }

  func testStaleSelectionsAppearAsExtraColumns() {
    let slots = EVYDatetime.buildCalendarSlots(
      row: calendarRow(startTime: "09:00", endTime: "11:00", timeslotIntervalMinutes: "60"),
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
      row: calendarRow(startTime: "07:00", endTime: "09:00"),
      primarySelections: ["2026-05-20T07:00:00"],
      secondarySelections: []
    )
    let labelledSlots = slots.filter { $0.x == 0 && !$0.timeLabel.isEmpty }
    XCTAssertEqual(labelledSlots.map { $0.timeLabel }, ["7:00", "8:00"])
  }

  func testTimeLabelFormattedWithPlainTimeslotFormat() {
    let slots = EVYDatetime.buildCalendarSlots(
      row: calendarRow(
        startTime: "09:00",
        endTime: "11:00",
        timeslotIntervalMinutes: "60",
        timeslotFormat: "h:mm a"
      ),
      primarySelections: ["2026-05-20T09:00:00"],
      secondarySelections: []
    )
    let labelledSlots = slots.filter { $0.x == 0 && !$0.timeLabel.isEmpty }
    XCTAssertEqual(labelledSlots.map { $0.timeLabel }, ["9:00 AM", "10:00 AM"])
  }

  // TODO: remove after migration
  func testCalendarFormatValueSupportsLegacyExpression() {
    let formatted = EVYDatetime.formatCalendarValue(
      "2026-06-03T09:00:00",
      patternOrExpression: "{formatDatetime($datum, \"EEE d\")}"
    )
    XCTAssertEqual(formatted, "Wed 3")
  }

  func testPrimarySelectionIsDetectedCorrectly() {
    let slots = EVYDatetime.buildCalendarSlots(
      row: calendarRow(startTime: "09:00", endTime: "11:00", timeslotIntervalMinutes: "60"),
      primarySelections: ["2026-06-03T09:00:00"],
      secondarySelections: []
    )
    let selected = slots.filter { $0.isPrimarySelected }
    XCTAssertEqual(selected.count, 1)
    XCTAssertEqual(selected.first?.dateTimeISO, "2026-06-03T09:00:00")
  }

  func testSecondarySelectionIsDetectedCorrectly() {
    let slots = EVYDatetime.buildCalendarSlots(
      row: calendarRow(startTime: "09:00", endTime: "11:00", timeslotIntervalMinutes: "60"),
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
      row: calendarRow(startTime: "09:00", endTime: "10:00", timeslotIntervalMinutes: "60"),
      primarySelections: ["2026-06-03T09:00:00"],
      secondarySelections: []
    )
    XCTAssertEqual(slots.first?.header, "Wed 3")
  }

  func testInvalidTimeRangeProducesZeroSlots() {
    let slots = EVYDatetime.buildCalendarSlots(
      row: calendarRow(startTime: "10:00", endTime: "09:00"),
      primarySelections: [],
      secondarySelections: []
    )
    XCTAssertEqual(slots.count, 0)
  }

  func testInvalidIntervalInputsUseDefaultInterval() {
    for invalidInterval in ["0", "invalid"] {
      let slots = EVYDatetime.buildCalendarSlots(
        row: calendarRow(timeslotIntervalMinutes: invalidInterval),
        primarySelections: [],
        secondarySelections: []
      )
      XCTAssertEqual(slots.count, 7 * 24, "Expected default interval for '\(invalidInterval)'")
    }
  }

  func testColumnCountIsStableWhenPrimarySelectionChanges() {
    let row = calendarRow(startTime: "09:00", endTime: "10:00", timeslotIntervalMinutes: "60")
    let baselineSlots = EVYDatetime.buildCalendarSlots(
      row: row,
      primarySelections: [],
      secondarySelections: []
    )
    let baselineColumns = Set(baselineSlots.map { $0.x }).count

    let afterSelect = EVYDatetime.buildCalendarSlots(
      row: row,
      primarySelections: ["\(todayPlus(2))T09:00:00"],
      secondarySelections: []
    )
    let afterColumns = Set(afterSelect.map { $0.x }).count

    XCTAssertEqual(baselineColumns, 7)
    XCTAssertEqual(afterColumns, 7)
  }

  func testColumnCountIsStableWhenSecondarySelectionChanges() {
    let withinWindow = EVYDatetime.buildCalendarSlots(
      row: calendarRow(startTime: "09:00", endTime: "10:00", timeslotIntervalMinutes: "60"),
      primarySelections: [],
      secondarySelections: ["\(todayPlus(3))T09:00:00"]
    )
    let columns = Set(withinWindow.map { $0.x }).count
    XCTAssertEqual(columns, 7)
  }

  func testDisplayTimeslotsAddsColumnWithoutSelection() {
    let slots = EVYDatetime.buildCalendarSlots(
      row: calendarRow(startTime: "09:00", endTime: "11:00", timeslotIntervalMinutes: "60"),
      primarySelections: [],
      secondarySelections: [],
      displayTimeslots: ["2026-05-20T09:00:00"]
    )
    let columns = Set(slots.map { $0.x }).count
    XCTAssertEqual(columns, 8)

    let displayDateSlots = slots.filter { $0.dateTimeISO.hasPrefix("2026-05-20") }
    XCTAssertFalse(displayDateSlots.isEmpty)
    XCTAssertTrue(displayDateSlots.allSatisfy { !$0.isPrimarySelected && !$0.isSecondarySelected })
  }

  func testTogglePrimarySelectionBatchAddsMissing() throws {
    let scopeId = "__test__:calendar-batch-add"
    let destination = "{pickup_selection}"
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }
    EVY.ensureDraftExists(
      variableName: "pickup_selection",
      initialData: "[\"2026-06-03T09:00:00\"]".data(using: .utf8),
      scopeId: scopeId
    )

    EVYCalendar.togglePrimarySelection(
      dateTimeISOs: ["2026-06-03T09:00:00", "2026-06-03T10:00:00"],
      destination: destination
    )

    let stored = EVYDatetime.readTimeslots(destination)
    XCTAssertEqual(Set(stored), Set(["2026-06-03T09:00:00", "2026-06-03T10:00:00"]))
  }

  func testTapRowSelectActionUsesTapRowTriggerList() throws {
    let scopeId = "__test__:calendar-tap-row-routing"
    let destination = "{pickup_selection}"
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }
    EVY.ensureDraftExists(variableName: "pickup_selection", scopeId: scopeId)

    let datum = EVYJson.array([
      .string("2026-06-03T09:00:00"),
      .string("2026-06-04T09:00:00"),
    ])
    let actions = UI_RowActions(
      tap: [rowAction(true: "{close()}")],
      tapRow: [rowAction(true: "{select($datum)}")]
    )

    EVYActionRunner.run(
      actions: actions.tapRow,
      datum: datum,
      rowOperation: { operation in
        guard case .select(let value) = operation else {
          throw EVYError.invalidData(context: "expected select")
        }
        try EVYCalendar.applyPrimarySelection(value: value, destination: destination)
      }
    ) { _ in }

    XCTAssertEqual(
      Set(EVYDatetime.readTimeslots(destination)),
      Set(["2026-06-03T09:00:00", "2026-06-04T09:00:00"])
    )
  }

}
