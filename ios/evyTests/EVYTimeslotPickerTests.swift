//
//  EVYTimeslotPickerTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYTimeslotPickerTests: XCTestCase {
  private let headerFormat = "{formatDatetime($datum, \"EEE\")}"
  private let headerSubtitle = "{formatDatetime($datum, \"MMM do\")}"
  private let timeslotFormat = "{formatDatetime($datum, \"HH:mm\")}"

  private func timeslotPickerRow(
    headerFormat: String? = nil,
    headerSubtitle: String? = nil,
    timeslotFormat: String? = nil
  ) -> TimeslotPickerRowViewData {
    let jsonObject: [String: Any] = [
      "title": "",
      "source": "{pickup_selection}",
      "destination": "{selected_timeslot}",
      "start_time": "07:00",
      "end_time": "19:00",
      "timeslot_interval_minutes": "30",
      "label_interval_minutes": "60",
      "header_format": headerFormat ?? self.headerFormat,
      "header_subtitle": headerSubtitle ?? self.headerSubtitle,
      "timeslot_format": timeslotFormat ?? self.timeslotFormat,
    ]
    let data = try! JSONSerialization.data(withJSONObject: jsonObject)
    return try! JSONDecoder().decode(TimeslotPickerRowViewData.self, from: data)
  }

  func testEmptySelectionsProducesNoDates() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: [],
      selectedTimeslot: nil
    )
    XCTAssertTrue(dates.isEmpty)
  }

  func testSingleDayGroupedCorrectly() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: ["2026-06-03T09:00:00", "2026-06-03T09:30:00"],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.count, 1)
    XCTAssertEqual(dates.first?.timeslots.count, 2)
  }

  func testMultipleDaysSortedChronologically() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: [
        "2026-06-05T11:00:00",
        "2026-06-03T09:00:00",
      ],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.count, 2)
    XCTAssertEqual(dates[0].timeslots.first?.timeslot, "09:00")
    XCTAssertEqual(dates[1].timeslots.first?.timeslot, "11:00")
  }

  func testTimeslotTimeFormattedAsHHmm() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: ["2026-06-03T09:30:00"],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.first?.timeslots.first?.timeslot, "09:30")
  }

  func testTimeslotFormattedWithTimeslotFormatExpression() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(timeslotFormat: "{formatDatetime($datum, \"h:mm a\")}"),
      availableSelections: ["2026-06-03T09:30:00"],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.first?.timeslots.first?.timeslot, "9:30 AM")
  }

  func testHeaderFormattedWithHeaderFormat() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: ["2026-06-03T09:00:00"],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.first?.header, "Wed")
  }

  func testHeaderSubtitleFormattedWithHeaderSubtitle() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: ["2026-06-03T09:00:00"],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.first?.subtitle, "Jun 3rd")
  }

  func testAllTimeslotsAreAvailable() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: [
        "2026-06-03T09:00:00",
        "2026-06-03T09:30:00",
        "2026-06-03T14:00:00",
      ],
      selectedTimeslot: nil
    )
    let allAvailable = dates.flatMap { $0.timeslots }.allSatisfy { $0.available }
    XCTAssertTrue(allAvailable)
  }

  func testInvalidSelectionStringSkipped() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: ["not-a-date", "2026-06-03T09:00:00", "short"],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.count, 1)
    XCTAssertEqual(dates.first?.timeslots.count, 1)
  }

  func testDaysWithNoSelectionsAreExcluded() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: [
        "2026-06-03T09:00:00",
        "2026-06-05T11:00:00",
      ],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.count, 2)
    let headers = dates.map { $0.header }
    XCTAssertFalse(headers.contains("Thu"))
  }

  func testTimeslotsWithinOneDaySortedChronologically() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      row: timeslotPickerRow(),
      availableSelections: [
        "2026-06-03T14:00:00",
        "2026-06-03T09:00:00",
        "2026-06-03T11:30:00",
      ],
      selectedTimeslot: nil
    )
    XCTAssertEqual(dates.first?.timeslots.map { $0.timeslot }, ["09:00", "11:30", "14:00"])
  }

  func testSelectActionCommitsTimeslotViaRowOperation() throws {
    let scopeId = "__test__:timeslot-select-action"
    let selectedTimeslot = "2026-06-03T09:30:00"
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    EVY.ensureDraftExists(variableName: "selected_timeslot", scopeId: scopeId)
    let destination = "{selected_timeslot}"
    let action = rowAction(true: .select(value: "$datum"))

    EVYActionRunner.run(
      actions: [action],
      datum: .string(selectedTimeslot),
      rowOperation: { operation in
        switch operation {
        case .select(let value):
          EVYTimeslotPicker.commitSelection(value.toString(), to: destination)
        default:
          throw EVYError.invalidData(context: "unexpected row operation")
        }
      }
    ) { _ in }

    XCTAssertEqual(try? EVY.getDataFromText(destination), .string(selectedTimeslot))
  }

  func testCommitSelectionWritesSelectedTimeslot() throws {
    let scopeId = "__test__:timeslot-commit"
    let selectedTimeslot = "2026-06-03T10:00:00"
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    EVY.ensureDraftExists(variableName: "selected_timeslot", scopeId: scopeId)
    EVYTimeslotPicker.commitSelection(
      selectedTimeslot,
      to: "{selected_timeslot}"
    )
    XCTAssertEqual(try? EVY.getDataFromText("{selected_timeslot}"), .string(selectedTimeslot))
  }
}
