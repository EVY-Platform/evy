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

  func testEmptySelectionsProducesNoDates() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: []
    )
    XCTAssertTrue(dates.isEmpty)
  }

  func testSingleDayGroupedCorrectly() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: ["2026-06-03T09:00:00", "2026-06-03T09:30:00"]
    )
    XCTAssertEqual(dates.count, 1)
    XCTAssertEqual(dates.first?.timeslots.count, 2)
  }

  func testMultipleDaysSortedChronologically() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: [
        "2026-06-05T11:00:00",
        "2026-06-03T09:00:00",
      ]
    )
    XCTAssertEqual(dates.count, 2)
    XCTAssertEqual(dates[0].timeslots.first?.timeslot, "09:00")
    XCTAssertEqual(dates[1].timeslots.first?.timeslot, "11:00")
  }

  func testTimeslotTimeFormattedAsHHmm() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: ["2026-06-03T09:30:00"]
    )
    XCTAssertEqual(dates.first?.timeslots.first?.timeslot, "09:30")
  }

  func testTimeslotFormattedWithTimeslotFormatExpression() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: "{formatDatetime($datum, \"h:mm a\")}",
      selections: ["2026-06-03T09:30:00"]
    )
    XCTAssertEqual(dates.first?.timeslots.first?.timeslot, "9:30 AM")
  }

  func testHeaderFormattedWithHeaderFormat() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: ["2026-06-03T09:00:00"]
    )
    XCTAssertEqual(dates.first?.header, "Wed")
  }

  func testHeaderSubtitleFormattedWithHeaderSubtitle() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: ["2026-06-03T09:00:00"]
    )
    XCTAssertEqual(dates.first?.subtitle, "Jun 3rd")
  }

  func testAllTimeslotsAreAvailable() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: [
        "2026-06-03T09:00:00",
        "2026-06-03T09:30:00",
        "2026-06-03T14:00:00",
      ]
    )
    let allAvailable = dates.flatMap { $0.timeslots }.allSatisfy { $0.available }
    XCTAssertTrue(allAvailable)
  }

  func testInvalidSelectionStringSkipped() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: ["not-a-date", "2026-06-03T09:00:00", "short"]
    )
    XCTAssertEqual(dates.count, 1)
    XCTAssertEqual(dates.first?.timeslots.count, 1)
  }

  func testDaysWithNoSelectionsAreExcluded() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: [
        "2026-06-03T09:00:00",
        "2026-06-05T11:00:00",
      ]
    )
    XCTAssertEqual(dates.count, 2)
    let headers = dates.map { $0.header }
    XCTAssertFalse(headers.contains("Thu"))
  }

  func testTimeslotsWithinOneDaySortedChronologically() {
    let dates = EVYDatetime.buildTimeslotPickerDates(
      headerFormat: headerFormat,
      headerSubtitle: headerSubtitle,
      timeslotFormat: timeslotFormat,
      selections: [
        "2026-06-03T14:00:00",
        "2026-06-03T09:00:00",
        "2026-06-03T11:30:00",
      ]
    )
    XCTAssertEqual(dates.first?.timeslots.map { $0.timeslot }, ["09:00", "11:30", "14:00"])
  }
}
