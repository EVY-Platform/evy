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
 * SDUI Data types
 */
public struct EVYCalendarTimeslotData: Decodable {
    let x: Int
    let y: Int
    let header: String
    let start_label: String
    let end_label: String
    let selected: Bool
}

/**
 * Util structs
 */
public struct EVYCalendarTimeslot {
    let id: String
    let x: Int
    let y: Int
    let datasourceIndex: Int
    let isSelected: Bool
    let hasSecondary: Bool
    
    init(x: Int, y: Int, datasourceIndex: Int, isSelected: Bool, hasSecondary: Bool) {
        self.id = "\(x)_\(y)"
        self.x = x
        self.y = y
        self.datasourceIndex = datasourceIndex
        self.isSelected = isSelected
        self.hasSecondary = hasSecondary
    }
}

/**
 * Calendar subviews
 */
struct EVYCalendarTimeslotView: View {
    let id: String
    let hasSecondary: Bool
    let action: (_ value: Bool) -> Void
    
    @State private var selected: Bool
    
    init(id: String,
         selected: Bool,
         hasSecondary: Bool,
         action: @escaping (_ value: Bool) -> Void)
    {
        self.id = id
        self.hasSecondary = hasSecondary
        self.action = action
        self.selected = selected
    }
        
    
    public func performAction() -> Void {
        selected.toggle()
        action(selected)
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

struct EVYCalendarContentView: View {
    let numberOfDays: Int
    let numberOfTimeslotsPerDay: Int
    let timeslots: [[Int]: EVYCalendarTimeslot]
    
    var body: some View {
        HStack(spacing: .zero) {
            ForEach((0..<numberOfDays), id: \.self) { x in
                VStack(alignment: .leading, spacing: 0) {
                    ForEach((0..<numberOfTimeslotsPerDay), id: \.self) { y in
                        let timeslot = timeslots[[x,y]]!
                        EVYCalendarTimeslotView(id: timeslot.id,
                                                selected: timeslot.isSelected,
                                                hasSecondary: timeslot.hasSecondary,
                                                action:{ value in
                            let valueString = value ? "true" : "false"
                            let props = "{pickupTimeslots[\(timeslot.datasourceIndex)}"
                            try! EVY.updateValue(valueString, at: props)
                        })
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
    }
}

struct EVYCalendarYAxisView: View {
    let labels: [String]
    @Binding var offset: CGPoint
    
    var body: some View {
        VStack(spacing: .zero) {
            // empty corner
            Color.clear.frame(width: .zero, height: rowHeight-spaceForFirstLabel)
            ScrollView([.vertical]) {
                // Offset based on scroll position but also add to center correctly
                VStack(spacing: .zero) {
                    ForEach(labels, id: \.self)  { label in
                        EVYTextView(label, style: .info)
                            .frame(height: rowHeight)
                            .frame(width: columnWidth)
                    }
                }.offset(y: offset.y-spaceForFirstLabel)
            }.scrollDisabled(true)
        }
    }
}

struct EVYCalendarXAxisView: View {
    let labels: [String]
    @Binding var offset: CGPoint
    
    var body: some View {
        ScrollView([.horizontal]) {
            HStack(spacing: .zero) {
                ForEach(labels, id: \.self)  { label in
                    EVYTextView(label, style: .info)
                        .frame(height: rowHeight)
                        .frame(width: columnWidth)
                }
            }.offset(x: offset.x)
        }.scrollDisabled(true)
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
    private var yLabels: [String] = []
    private var xLabels: [String] = []
    private var timeslots: [[Int]: EVYCalendarTimeslot] = [:]
    
    @State private var offset = CGPoint.zero
    
    init(primary: String, secondary: String) {
        var primaryTimeslots: [EVYCalendarTimeslotData] = []
        var secondaryTimeslots: [EVYCalendarTimeslotData] = []
        
        do {
            let timeslotsJSON = try EVY.getDataFromText(primary)
            primaryTimeslots = try JSONDecoder().decode(
                [EVYCalendarTimeslotData].self,from: timeslotsJSON.toString().data(using: .utf8)!
            )
            xLabels = primaryTimeslots
                .filter({ $0.y == 0})
                .map({ String($0.header) })
            yLabels = primaryTimeslots
                .filter({ $0.x == 0})
                .map({ $0.start_label })
            yLabels.append(primaryTimeslots.last!.end_label)
        } catch {}
        
        do {
            let timeslotsJSON = try EVY.getDataFromText(secondary)
            secondaryTimeslots = try JSONDecoder().decode(
                [EVYCalendarTimeslotData].self, from: timeslotsJSON.toString().data(using: .utf8)!
            )
        } catch {}
        
        let numberOfTimeslotsPerDay = yLabels.count-1
        let numberOfDays = xLabels.count
        for x in (0..<numberOfDays) {
            for y in (0..<numberOfTimeslotsPerDay) {
                let relevantIndex = y+(x*numberOfTimeslotsPerDay)
                let primarySelected = primaryTimeslots[relevantIndex].selected
                let secondarySelected = secondaryTimeslots[relevantIndex].selected
                timeslots[[x,y]] = EVYCalendarTimeslot(x: x, y: y,
                                                       datasourceIndex: relevantIndex,
                                                       isSelected: primarySelected,
                                                       hasSecondary: secondarySelected)
            }
        }
    }
    
    var body: some View {
        HStack(spacing: .zero) {
            EVYCalendarYAxisView(labels: yLabels, offset: $offset)
            VStack(spacing: .zero) {
                EVYCalendarXAxisView(labels: xLabels, offset: $offset)
                ScrollViewReader { _ in
                    ScrollView([.vertical, .horizontal]) {
                        EVYCalendarContentView(numberOfDays: xLabels.count,
                                               numberOfTimeslotsPerDay: yLabels.count-1,
                                               timeslots: timeslots)
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
