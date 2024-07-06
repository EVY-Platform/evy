//
//  EVYCalendar.swift
//  evy
//
//  Created by Geoffroy Lesage on 2/7/2024.
//

import SwiftUI

private let spaceForFirstLabel: CGFloat = 6
private let dividerWidth: CGFloat = 0.5
private let dividerOpacity: CGFloat = 0.5
private let timeslotOpactity: CGFloat = 0.7
private let columnWidth: CGFloat = 80
private let rowHeight: CGFloat = 30

/**
 * Utils
 */
public extension Sequence {
    /// Usage:
    /// ```
    /// arr.group(by: { $0.propertyName })
    /// ```
    func group<T: Hashable>(by key: (Iterator.Element) -> T) -> [T : [Self.Element]] {
        return Dictionary(grouping: self, by: key )
    }
}

/**
 * SDUI Data types
 */
public struct EVYCalendarTimeslot: Decodable {
    let x: Int
    let y: Int
    let header: String
    let start_label: String
    let end_label: String
    let selected: Bool
}

/**
 * Calendar subviews
 */
struct EVYCalendarTimeslotView: View {
    let id: String
    let hasSecondary: Bool
    let action: () -> Void
    
    @State private var selected: Bool
    
    init(id: String,
         selected: Bool,
         hasSecondary: Bool,
         action: @escaping () -> Void)
    {
        self.id = id
        self.hasSecondary = hasSecondary
        self.action = action
        self.selected = selected
    }
        
    
    public func performAction() -> Void {
        action()
        selected.toggle()
    }
    
    var body: some View {
        Button(action: performAction) {
            VStack(spacing: .zero) {
                Rectangle()
                    .fill(selected ? Constants.buttonColor :
                            (hasSecondary ? Constants.inactiveBackground : .clear)
                    )
                    .opacity(timeslotOpactity)
            }
        }
        .frame(height: rowHeight)
        .frame(width: columnWidth)
        .id(id)
    }
}

struct EVYCalendarTimeslotColumn: View {
    let identifier: Int
    let timeslots: [EVYCalendarTimeslotView]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(timeslots, id: \.id)  { timeslot in
                timeslot
            }
        }
        .overlay(
            Divider()
                .opacity(dividerOpacity)
                .frame(maxWidth: dividerWidth, maxHeight: .infinity)
                .background(Constants.inactiveBackground), alignment: .leading
        )
    }
}

struct EVYCalendarYAxisLabels: View {
    let labels: [String]
    
    var body: some View {
        VStack(spacing: .zero) {
            ForEach(labels, id: \.self)  { label in
                EVYTextView(label, style: .info)
                    .frame(height: rowHeight)
                    .frame(width: columnWidth)
            }
        }
    }
}

struct EVYCalendarXAxisLabels: View {
    let labels: [String]
    
    var body: some View {
        HStack(spacing: .zero) {
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
    private let yAxis: EVYCalendarYAxisLabels
    private let xAxis: EVYCalendarXAxisLabels
    private let columns: [EVYCalendarTimeslotColumn]
    private let primaryTimeslots: [EVYCalendarTimeslot]
    private let secondaryTimeslots: [EVYCalendarTimeslot]
    
    @State private var offset = CGPoint.zero
    
    init(primary: String, secondary: String) {
        var xLabels: [String] = []
        var yLabels: [String] = []
        
        do {
            let timeslotsJSON = try EVY.getDataFromText(primary)
            primaryTimeslots = try! JSONDecoder().decode(
                [EVYCalendarTimeslot].self, from: timeslotsJSON.toString().data(using: .utf8)!
            )
            xLabels = primaryTimeslots
                .filter({ $0.y == 0})
                .map({ String($0.header) })
            yLabels = primaryTimeslots
                .filter({ $0.x == 0})
                .map({ $0.start_label })
            yLabels.append(primaryTimeslots.last!.end_label)
        } catch {
            primaryTimeslots = []
        }
        
        do {
            let timeslotsJSON = try EVY.getDataFromText(secondary)
            secondaryTimeslots = try! JSONDecoder().decode(
                [EVYCalendarTimeslot].self, from: timeslotsJSON.toString().data(using: .utf8)!
            )
        } catch {
            secondaryTimeslots = []
        }
        
        xAxis = EVYCalendarXAxisLabels(labels: xLabels)
        yAxis = EVYCalendarYAxisLabels(labels: yLabels)
        
        let numberOfTimeslotsPerDay = yLabels.count-1
        let numberOfDays = xLabels.count
        var columns: [EVYCalendarTimeslotColumn] = []
        for x in (0..<numberOfDays) {
            var currentTimeslots: [EVYCalendarTimeslotView] = []
            for y in (0..<numberOfTimeslotsPerDay) {
                let relevantIndex = y+(x*numberOfTimeslotsPerDay)
                let primarySelected = primaryTimeslots[relevantIndex].selected
                let secondarySelected = secondaryTimeslots[relevantIndex].selected
                currentTimeslots.append(
                    EVYCalendarTimeslotView(id: "\(x)_\(y)",
                                            selected: primarySelected,
                                            hasSecondary: secondarySelected,
                                            action: {
                                                print("test")
                                            })
                )
            }
            columns.append(
                EVYCalendarTimeslotColumn(identifier: x, timeslots: currentTimeslots)
            )
        }
        self.columns = columns
    }
    
    var body: some View {
        HStack(spacing: .zero) {
            VStack(spacing: .zero) {
                // empty corner
                Color.clear.frame(width: .zero, height: rowHeight-spaceForFirstLabel)
                
                // Y Axis
                ScrollView([.vertical]) {
                    // Offset based on scroll position but also add to center correctly
                    yAxis.offset(y: offset.y-spaceForFirstLabel)
                }.disabled(true)
            }
            VStack(spacing: .zero) {
                // X Axis
                ScrollView([.horizontal]) {
                    xAxis.offset(x: offset.x)
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
                    }
                }
                .coordinateSpace(name: "scroll")
            }
        }
    }
}

#Preview {
    let pickup = DataConstants.pickupTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "pickupTimeslots", data: pickup)
    
    let delivery = DataConstants.deliveryTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "deliveryTimeslots", data: delivery)

    return EVYCalendar(primary: "pickupTimeslots", secondary: "deliveryTimeslots")
}
