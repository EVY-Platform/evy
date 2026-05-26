//
//  EVYCalendarTests.swift
//  evyTests
//

import XCTest

@testable import evy

final class EVYCalendarTests: XCTestCase {

    private func todayPlus(_ days: Int) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let date = Calendar.current.date(byAdding: .day, value: days, to: Date())!
        return formatter.string(from: date)
    }

    func testSlotCountFor12HourRangeAt30MinIntervals() {
        let slots = buildCalendarSlots(
            startTime: "07:00",
            endTime: "19:00",
            intervalMinutes: 30,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: [],
            secondarySelections: []
        )
        // 7 fallback columns × 24 rows
        XCTAssertEqual(slots.count, 7 * 24)
    }

    func testStaleSelectionsAppearAsExtraColumns() {
        let slots = buildCalendarSlots(
            startTime: "09:00",
            endTime: "11:00",
            intervalMinutes: 60,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: [],
            secondarySelections: [
                "2024-09-18T09:00:00",
                "2024-09-19T09:00:00",
                "2024-09-20T10:00:00",
            ]
        )
        let columns = Set(slots.map { $0.x }).count
        // 7 fallback + 3 stale 2024 dates
        XCTAssertEqual(columns, 10)
    }

    func testTimeLabelAppearsEveryLabelInterval() {
        let slots = buildCalendarSlots(
            startTime: "07:00",
            endTime: "09:00",
            intervalMinutes: 30,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: ["2024-09-18T07:00:00"],
            secondarySelections: []
        )
        // "2024-09-18" sorts before any future fallback date so it is column 0
        let labelledSlots = slots.filter { $0.x == 0 && !$0.timeLabel.isEmpty }
        XCTAssertEqual(labelledSlots.map { $0.timeLabel }, ["7:00", "8:00"])
    }

    func testPrimarySelectionIsDetectedCorrectly() {
        let slots = buildCalendarSlots(
            startTime: "09:00",
            endTime: "11:00",
            intervalMinutes: 60,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: ["2024-09-18T09:00:00"],
            secondarySelections: []
        )
        let selected = slots.filter { $0.isPrimarySelected }
        XCTAssertEqual(selected.count, 1)
        XCTAssertEqual(selected.first?.dateTimeISO, "2024-09-18T09:00:00")
    }

    func testSecondarySelectionIsDetectedCorrectly() {
        let slots = buildCalendarSlots(
            startTime: "09:00",
            endTime: "11:00",
            intervalMinutes: 60,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: [],
            secondarySelections: ["2024-09-18T10:00:00"]
        )
        let secondarySelected = slots.filter { $0.isSecondarySelected }
        XCTAssertEqual(secondarySelected.count, 1)
        XCTAssertEqual(secondarySelected.first?.dateTimeISO, "2024-09-18T10:00:00")
        XCTAssertFalse(secondarySelected.first!.isPrimarySelected)
    }

    func testHeaderFormattingForKnownDate() {
        let slots = buildCalendarSlots(
            startTime: "09:00",
            endTime: "10:00",
            intervalMinutes: 60,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: ["2024-09-18T09:00:00"],
            secondarySelections: []
        )
        XCTAssertEqual(slots.first?.header, "Wed 18")
    }

    func testInvalidTimeRangeProducesZeroSlots() {
        let slots = buildCalendarSlots(
            startTime: "10:00",
            endTime: "09:00",
            intervalMinutes: 30,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: [],
            secondarySelections: []
        )
        XCTAssertEqual(slots.count, 0)
    }

    func testZeroIntervalReturnsEmpty() {
        let slots = buildCalendarSlots(
            startTime: "07:00",
            endTime: "19:00",
            intervalMinutes: 0,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: ["2024-09-18T09:00:00"],
            secondarySelections: []
        )
        XCTAssertTrue(slots.isEmpty)
    }

    func testColumnCountIsStableWhenPrimarySelectionChanges() {
        let baselineSlots = buildCalendarSlots(
            startTime: "09:00",
            endTime: "10:00",
            intervalMinutes: 60,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: [],
            secondarySelections: []
        )
        let baselineColumns = Set(baselineSlots.map { $0.x }).count

        // Adding a primary selection within the 7-day window must not change the column count
        let afterSelect = buildCalendarSlots(
            startTime: "09:00",
            endTime: "10:00",
            intervalMinutes: 60,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: ["\(todayPlus(2))T09:00:00"],
            secondarySelections: []
        )
        let afterColumns = Set(afterSelect.map { $0.x }).count

        XCTAssertEqual(baselineColumns, 7)
        XCTAssertEqual(afterColumns, 7)
    }

    func testColumnCountIsStableWhenSecondarySelectionChanges() {
        // Simulates the linked-calendar scenario: when the other calendar's primary
        // (this calendar's secondary) gains selections, this calendar's grid must not collapse.
        let withinWindow = buildCalendarSlots(
            startTime: "09:00",
            endTime: "10:00",
            intervalMinutes: 60,
            labelIntervalMinutes: 60,
            headerFormat: "EEE d",
            primarySelections: [],
            secondarySelections: ["\(todayPlus(3))T09:00:00"]
        )
        let columns = Set(withinWindow.map { $0.x }).count
        XCTAssertEqual(columns, 7)
    }
}
