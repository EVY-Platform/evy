//
//  EVYCalendar.swift
//  evy
//
//  Created by Geoffroy Lesage on 2/7/2024.
//

import SwiftUI

private extension Sequence {
    func toDictionary<Key: Hashable>(with selectKey: (Element) -> Key) -> [Key: Element] {
        reduce(into: [:]) { $0[selectKey($1)] = $1 }
    }
}

private protocol DatedWithStart {
    var start: Date { get }
}

private extension Array where Element: DatedWithStart {
    func groupedBy(_ dateComponents: Set<Calendar.Component>) -> [Date: [Element]] {
        let initial: [Date: [Element]] = [:]
        let groupedByDateComponents = reduce(into: initial) { acc, cur in
            let components = Calendar.current.dateComponents(dateComponents, from: cur.start)
            let date = Calendar.current.date(from: components)!
            let existing = acc[date] ?? []
            acc[date] = existing + [cur]
        }
        
        return groupedByDateComponents
    }
}

struct EVYCalendarTimeslot: Decodable, DatedWithStart {
    let start: Date
    let end: Date
    let available: Bool
}

enum EVYCalendarTimeslotStyle: String {
    case primary
    case secondary
    case none
}

private let labelWidth: CGFloat = 60
private let columnWidth: CGFloat = 80
private let rowHeight: CGFloat = 50

struct EVYCalendarTimeslotView: View {
    let start: Int
    let end: Int
    let action: () -> Void
    
    private let fillColor: Color
    
    init(start: Int, end: Int, style: EVYCalendarTimeslotStyle, action: @escaping () -> Void) {
        self.start = start
        self.end = end
        self.action = action
        
        switch style {
        case .primary:
            fillColor = Constants.buttonColor
        case .secondary:
            fillColor = Constants.inactiveBackground
        default:
            fillColor = .clear
        }
    }
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: .zero) {
                Divider().background(Constants.inactiveBackground)
                Rectangle().fill(fillColor)
            }
        }
        .frame(height: rowHeight)
        .frame(width: columnWidth)
    }
}

struct EVYCalendarTimeslotColumn: View {
    let header: String
    let timeslots: [EVYCalendarTimeslotView]
    
    var body: some View {
        VStack(spacing: .zero) {
            EVYTextView(header).padding(Constants.minPading)
            ForEach(timeslots, id: \.start)  { timeslot in
                timeslot
            }
        }.overlay( Divider()
            .frame(maxWidth: 0.5, maxHeight: .infinity)
            .background(Constants.inactiveBackground), alignment: .leading )
    }
}

struct EVYCalendarLabelColumn: View {
    let labels: [String]
    
    var body: some View {
        VStack(spacing: .zero) {
            EVYTextView("").padding(Constants.minPading)
            ForEach(labels, id: \.self)  { label in
                EVYTextView(label, style: .info)
                    .frame(height: rowHeight)
                    .frame(width: labelWidth)
            }
        }
    }
}

struct EVYCalendar: View {
    private let labelsColumn: EVYCalendarLabelColumn
    private var columns: [EVYCalendarTimeslotColumn] = []
    
    init(_ timeslots: [EVYCalendarTimeslot]) {
        var numberOfTimeslotsPerDay: Int
        let firstTimeslot = timeslots.first!
        switch firstTimeslot.end.timeIntervalSince(firstTimeslot.start) {
        case 900:
            numberOfTimeslotsPerDay = 96
        case 1800:
            numberOfTimeslotsPerDay = 48
        default:
            numberOfTimeslotsPerDay = 24
        }
        
        var labels: [String] = []
        for timeslotIndex in 0...numberOfTimeslotsPerDay-1 {
            labels.append("\(timeslotIndex+1):00")
        }
        labelsColumn = EVYCalendarLabelColumn(labels: labels)
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "EEE d"
        
        let timeslotsByDate = timeslots.groupedBy([.year, .month, .day])
        for date in timeslotsByDate.keys.sorted() {
            let dateTimeslots = timeslotsByDate[date]!
            let timeslotsByTimeslotIndex = dateTimeslots.toDictionary {
                return Calendar.current.component(.hour, from: $0.start)
            }
            
            var timeslotViews: [EVYCalendarTimeslotView] = []
            for timeslotIndex in 0...numberOfTimeslotsPerDay-1 {
                if let timeslot = timeslotsByTimeslotIndex[timeslotIndex] {
                    timeslotViews.append(EVYCalendarTimeslotView(start: timeslotIndex,
                                                                 end: timeslotIndex+1,
                                                                 style: timeslot.available ? .primary : .secondary,
                                                                 action: { print("test")}))
                    
                } else {
                    timeslotViews.append(EVYCalendarTimeslotView(start: timeslotIndex,
                                                                 end: timeslotIndex+1,
                                                                 style: .none,
                                                                 action: { print("test")}))
                }
            }
            
            self.columns.append(
                EVYCalendarTimeslotColumn(header: dateFormatter.string(from:date),
                                          timeslots: timeslotViews)
            )
        }
    }
    
    var body: some View {
        ScrollView(.horizontal, content: {
            ScrollView(.vertical, content: {
                HStack(spacing: .zero) {
                    labelsColumn
                    ForEach(columns, id: \.header) { column in
                        column
                    }
                }
            })
        })
    }
}

#Preview {
    let now = Calendar.current.date( byAdding: .hour, value: 0, to: Date())!
    let nowPlus1 = Calendar.current.date( byAdding: .hour, value: 1, to: Date())!
    let nowPlus2 = Calendar.current.date( byAdding: .hour, value: 2, to: Date())!
    let nowPlus3 = Calendar.current.date( byAdding: .hour, value: 3, to: Date())!
    let nowPlus4 = Calendar.current.date( byAdding: .hour, value: 4, to: Date())!
    
    let nowTomorrow = Calendar.current.date( byAdding: .day, value: 1, to: now)!
    let nowTomorrowPlus1 = Calendar.current.date( byAdding: .day, value: 1, to: nowPlus1)!
    let nowTomorrowPlus2 = Calendar.current.date( byAdding: .day, value: 1, to: nowPlus2)!
    
    let now2DaysPlus1 = Calendar.current.date( byAdding: .day, value: 2, to: nowPlus1)!
    let now2DaysPlus2 = Calendar.current.date( byAdding: .day, value: 2, to: nowPlus2)!
    let now2DaysPlus3 = Calendar.current.date( byAdding: .day, value: 2, to: nowPlus3)!
    let now3DaysPlus1 = Calendar.current.date( byAdding: .day, value: 3, to: nowPlus1)!
    let now3DaysPlus2 = Calendar.current.date( byAdding: .day, value: 3, to: nowPlus2)!
    let now4Days = Calendar.current.date( byAdding: .day, value: 4, to: now)!
    let now4DaysPlus1 = Calendar.current.date( byAdding: .day, value: 4, to: nowPlus1)!
    let now5Days = Calendar.current.date( byAdding: .day, value: 5, to: now)!
    let now5DaysPlus1 = Calendar.current.date( byAdding: .day, value: 5, to: nowPlus1)!

    return EVYCalendar([
        EVYCalendarTimeslot(start: now, end: nowPlus1, available: false),
        EVYCalendarTimeslot(start: nowPlus1, end: nowPlus2, available: true),
        EVYCalendarTimeslot(start: nowPlus3, end: nowPlus4, available: true),
        EVYCalendarTimeslot(start: nowTomorrow, end: nowTomorrowPlus1, available: true),
        EVYCalendarTimeslot(start: nowTomorrowPlus1, end: nowTomorrowPlus2, available: false),
        EVYCalendarTimeslot(start: now2DaysPlus1, end: now2DaysPlus1, available: false),
        EVYCalendarTimeslot(start: now2DaysPlus2, end: now2DaysPlus3, available: true),
        EVYCalendarTimeslot(start: now3DaysPlus1, end: now3DaysPlus2, available: true),
        EVYCalendarTimeslot(start: now4Days, end: now4DaysPlus1, available: true),
        EVYCalendarTimeslot(start: now5Days, end: now5DaysPlus1, available: true),
        
    ])
}
