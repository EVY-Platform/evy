//
//  EVYCalendar.swift
//  evy
//
//  Created by Geoffroy Lesage on 2/7/2024.
//

import SwiftUI

private let dividerWidth: CGFloat = 0.5
private let dividerOpacity: CGFloat = 0.5
private let columnWidth: CGFloat = 80
private let rowHeight: CGFloat = 50

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

struct EVYCalendarTimeslotView: View {
    let identifier: String
    let start: Int
    let end: Int
    let action: () -> Void
    
    private let fillColor: Color
    
    init(identifier: String,
         start: Int,
         end: Int,
         style: EVYCalendarTimeslotStyle,
         action: @escaping () -> Void)
    {
        self.identifier = identifier
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
                Divider()
                    .background(Constants.inactiveBackground)
                    .opacity(dividerOpacity)
                Rectangle().fill(fillColor)
            }
        }
        .frame(height: rowHeight)
        .frame(width: columnWidth)
        .id(identifier)
    }
}

struct EVYCalendarTimeslotColumn: View {
    let identifier: String
    let timeslots: [EVYCalendarTimeslotView]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(timeslots, id: \.start)  { timeslot in
                timeslot
            }
        }.overlay( Divider()
            .opacity(dividerOpacity)
            .frame(maxWidth: dividerWidth, maxHeight: .infinity)
            .background(Constants.inactiveBackground), alignment: .leading )
    }
}

struct EVYCalendarYAxixLabels: View {
    let labels: [String]
    
    var body: some View {
        VStack(spacing: .zero) {
            EVYTextView("").padding(Constants.minPading)
            ForEach(labels, id: \.self)  { label in
                EVYTextView(label, style: .info)
                    .frame(height: rowHeight)
                    .frame(width: columnWidth)
            }
        }
    }
}

struct EVYCalendarXAxixLabels: View {
    let labels: [String]
    
    var body: some View {
        HStack(spacing: .zero) {
            EVYTextView("").padding(Constants.minPading)
            ForEach(labels, id: \.self)  { label in
                EVYTextView(label, style: .info)
                    .frame(height: rowHeight)
                    .frame(width: columnWidth)
            }
        }
    }
}

struct ViewOffsetKey: PreferenceKey {
    typealias Value = CGPoint
    static var defaultValue = CGPoint.zero
    static func reduce(value: inout Value, nextValue: () -> Value) {
        value.x += nextValue().x
        value.y += nextValue().y
    }
}

struct EVYCalendar: View {
    let columnsNum = 20
    let rows = 30
    
    private let yAxis: EVYCalendarYAxixLabels
    private let xAxis: EVYCalendarXAxixLabels
    private var columns: [EVYCalendarTimeslotColumn] = []
    
    @State private var offset = CGPoint.zero
    
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
        
        var yLabels: [String] = []
        for timeslotIndex in 0...numberOfTimeslotsPerDay-1 {
            yLabels.append("\(timeslotIndex+1):00")
        }
        yAxis = EVYCalendarYAxixLabels(labels: yLabels)
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "EEE d"
        
        var xLabels: [String] = []
        let timeslotsByDate = timeslots.groupedBy([.year, .month, .day])
        let sortedDates = timeslotsByDate.keys.sorted()
        for dateIndex in sortedDates.indices {
            let date = sortedDates[dateIndex]
            let formatedDate = dateFormatter.string(from:date)
            xLabels.append(formatedDate)
            let dateTimeslots = timeslotsByDate[date]!
            let timeslotsByTimeslotIndex = dateTimeslots.toDictionary {
                return Calendar.current.component(.hour, from: $0.start)
            }
            
            var timeslotViews: [EVYCalendarTimeslotView] = []
            for timeslotIndex in 0...numberOfTimeslotsPerDay-1 {
                let identifier = "\(dateIndex)_\(timeslotIndex)"
                if let timeslot = timeslotsByTimeslotIndex[timeslotIndex] {
                    timeslotViews.append(EVYCalendarTimeslotView(identifier: identifier,
                                                                 start: timeslotIndex,
                                                                 end: timeslotIndex+1,
                                                                 style: timeslot.available ? .primary : .secondary,
                                                                 action: { print("test")}))
                    
                } else {
                    timeslotViews.append(EVYCalendarTimeslotView(identifier: identifier,
                                                                 start: timeslotIndex,
                                                                 end: timeslotIndex+1,
                                                                 style: .none,
                                                                 action: { print("test")}))
                }
            }
            
            self.columns.append(
                EVYCalendarTimeslotColumn(identifier: formatedDate,
                                          timeslots: timeslotViews)
            )
        }
        
        xAxis = EVYCalendarXAxixLabels(labels: xLabels)
    }
    
    var body: some View {
        HStack(spacing: .zero) {
            VStack(spacing: .zero) {
                // empty corner
                Color.clear.frame(width: .zero, height: rowHeight)
                
                // Y Axis
                ScrollView([.vertical]) {
                    yAxis.offset(y: offset.y-(columnWidth*0.2))
                }.disabled(true)
            }
            VStack(spacing: .zero) {
                // X Axis
                ScrollView([.horizontal]) {
                    xAxis.offset(x: offset.x-(rowHeight*0.2))
                }.disabled(true)
                
                // Content
                ScrollViewReader { cellProxy in
                    ScrollView([.vertical, .horizontal]) {
                        HStack(alignment: .top, spacing: 0) {
                            ForEach(columns, id: \.identifier) { column in
                                column
                            }
                        }
                        .background( GeometryReader { geo in
                            Color.clear
                                .preference(key: ViewOffsetKey.self,
                                            value: geo.frame(in: .named("scroll")).origin)
                        })
                        .onPreferenceChange(ViewOffsetKey.self) { value in
                            offset = value
                        }
                        .onAppear {
                            // Scroll on open to middle of day on the calendar
                            let y = Float(rows)*0.6
                            cellProxy.scrollTo("0_\(Int(y))")
                        }
                    }
                }
                .coordinateSpace(name: "scroll")
            }
        }
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
