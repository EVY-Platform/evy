//
//  EVYCalendarGridBuilder.swift
//  evy
//

import Foundation

func calendarDateString(fromSelection selection: String) -> String? {
    guard selection.count >= 10 else { return nil }
    let candidate = String(selection.prefix(10))
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    guard formatter.date(from: candidate) != nil else { return nil }
    return candidate
}

func buildCalendarSlots(
    startTime: String,
    endTime: String,
    intervalMinutes: Int,
    labelIntervalMinutes: Int,
    headerFormat: String,
    primarySelections: [String],
    secondarySelections: [String]
) -> [EVYCalendarSlot] {
    guard intervalMinutes > 0 else { return [] }

    let startParts = startTime.split(separator: ":").compactMap { Int($0) }
    let endParts = endTime.split(separator: ":").compactMap { Int($0) }
    guard startParts.count >= 2, endParts.count >= 2 else { return [] }

    let startMinutes = startParts[0] * 60 + startParts[1]
    let endMinutes = endParts[0] * 60 + endParts[1]
    guard endMinutes > startMinutes else { return [] }

    let numSlots = (endMinutes - startMinutes) / intervalMinutes
    guard numSlots > 0 else { return [] }

    let primarySet = Set(primarySelections)
    let secondarySet = Set(secondarySelections)

    var uniqueDates: [String] = []
    var seen = Set<String>()

    // Anchor columns to the next 7 days for a stable grid that does not collapse
    // when selections change. Selections only drive cell coloring.
    let isoFormatter = DateFormatter()
    isoFormatter.dateFormat = "yyyy-MM-dd"
    isoFormatter.locale = Locale(identifier: "en_US_POSIX")
    let today = Date()
    for i in 0..<7 {
        if let date = Calendar.current.date(byAdding: .day, value: i, to: today) {
            let dateStr = isoFormatter.string(from: date)
            uniqueDates.append(dateStr)
            seen.insert(dateStr)
        }
    }

    // Keep stale selections visible as extra columns when they fall outside the 7-day window
    for selection in primarySelections + secondarySelections {
        if let dateStr = calendarDateString(fromSelection: selection),
           !seen.contains(dateStr) {
            seen.insert(dateStr)
            uniqueDates.append(dateStr)
        }
    }

    uniqueDates.sort()

    let isoDateFormatter = DateFormatter()
    isoDateFormatter.dateFormat = "yyyy-MM-dd"
    isoDateFormatter.locale = Locale(identifier: "en_US_POSIX")

    let headerFormatter = DateFormatter()
    headerFormatter.dateFormat = headerFormat
    headerFormatter.locale = Locale(identifier: "en_US")

    var slots: [EVYCalendarSlot] = []

    for (x, dateStr) in uniqueDates.enumerated() {
        let date = isoDateFormatter.date(from: dateStr)
        let header = date.map { headerFormatter.string(from: $0) } ?? dateStr

        for y in 0..<numSlots {
            let slotTotalMinutes = startMinutes + y * intervalMinutes
            let slotHour = slotTotalMinutes / 60
            let slotMin = slotTotalMinutes % 60
            let timeISO = String(format: "%02d:%02d:00", slotHour, slotMin)
            let dateTimeISO = "\(dateStr)T\(timeISO)"

            let elapsedMinutes = y * intervalMinutes
            let timeLabel: String
            if labelIntervalMinutes > 0 && elapsedMinutes % labelIntervalMinutes == 0 {
                timeLabel = "\(slotHour):\(String(format: "%02d", slotMin))"
            } else {
                timeLabel = ""
            }

            slots.append(EVYCalendarSlot(
                dateTimeISO: dateTimeISO,
                x: x,
                y: y,
                header: header,
                timeLabel: timeLabel,
                isPrimarySelected: primarySet.contains(dateTimeISO),
                isSecondarySelected: secondarySet.contains(dateTimeISO)
            ))
        }
    }

    return slots
}
