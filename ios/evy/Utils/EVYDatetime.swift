//
//  EVYDatetime.swift
//  evy
//

import Foundation

@MainActor
enum EVYDatetime {
  static func buildTimeslotPickerDates(
    headerFormat: String,
    headerSubtitle: String,
    timeslotFormat: String,
    selections: [String]
  ) -> [EVYTimeslotDate] {
    guard !selections.isEmpty else { return [] }

    var dateToDateTimes: [String: [String]] = [:]
    for selection in selections {
      guard (try? Date(selection, strategy: .iso8601.year().month().day())) != nil else {
        continue
      }

      let dateStr = String(selection.prefix(10))
      dateToDateTimes[dateStr, default: []].append(selection)
    }

    return dateToDateTimes.keys.sorted().compactMap { dateStr in
      let dateTimes = (dateToDateTimes[dateStr] ?? []).sorted()
      guard let firstDateTime = dateTimes.first else { return nil }
      return EVYTimeslotDate(
        header: format(firstDateTime, format: headerFormat),
        subtitle: format(firstDateTime, format: headerSubtitle),
        timeslots: dateTimes.map {
          EVYTimeslot(timeslot: format($0, format: timeslotFormat), available: true)
        }
      )
    }
  }

  static func format(_ value: String, format: String) -> String {
    (try? EVY.formatDataOrToString(json: .string(value), format: format)) ?? value
  }

  static func readTimeslots(_ source: String) -> [String] {
    if let json = try? EVY.getDataFromText(source),
      let data = json.toString().data(using: .utf8)
    {
      return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    } else {
      return []
    }
  }

  static func buildCalendarSlots(
    startTime: String,
    endTime: String,
    intervalMinutes: Int,
    labelIntervalMinutes: Int,
    headerFormat: String,
    timeslotFormat: String,
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
    var seenDates = Set<Date>()

    let today = Date()
    for i in 0..<7 {
      if let date = Calendar.current.date(byAdding: .day, value: i, to: today) {
        let dayStart = localCalendarDayStart(for: date)
        if seenDates.insert(dayStart).inserted {
          uniqueDates.append(isoCalendarDateString(from: dayStart))
        }
      }
    }

    for selection in primarySelections + secondarySelections {
      if let dayStart = try? Date(selection, strategy: .iso8601.year().month().day()),
        seenDates.insert(dayStart).inserted
      {
        uniqueDates.append(isoCalendarDateString(from: dayStart))
      }
    }

    uniqueDates.sort()

    var slots: [EVYCalendarSlot] = []

    for (x, dateStr) in uniqueDates.enumerated() {
      let header = format("\(dateStr)T00:00:00", format: headerFormat)

      for y in 0..<numSlots {
        let slotTotalMinutes = startMinutes + y * intervalMinutes
        let slotHour = slotTotalMinutes / 60
        let slotMin = slotTotalMinutes % 60
        let timeISO = String(format: "%02d:%02d:00", slotHour, slotMin)
        let dateTimeISO = "\(dateStr)T\(timeISO)"

        let elapsedMinutes = y * intervalMinutes
        let timeLabel: String
        if labelIntervalMinutes > 0 && elapsedMinutes % labelIntervalMinutes == 0 {
          timeLabel = format(dateTimeISO, format: timeslotFormat)
        } else {
          timeLabel = ""
        }

        slots.append(
          EVYCalendarSlot(
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

  static func formattedCalendarTimeLabel(
    dateString: String,
    timeString: String,
    format formatPattern: String
  ) -> String {
    let timeWithSeconds = timeString.count == 5 ? "\(timeString):00" : timeString
    return format("\(dateString)T\(timeWithSeconds)", format: formatPattern)
  }

  private static func localCalendarDayStart(for date: Date) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .gmt
    let dateComponents = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return calendar.date(from: dateComponents) ?? date
  }

  static func isoCalendarDateString(from date: Date) -> String {
    let formatStyle = Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day()
    return date.formatted(formatStyle)
  }
}
