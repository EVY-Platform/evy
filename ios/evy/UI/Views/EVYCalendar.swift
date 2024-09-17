//
//  EVYCalendar.swift
//  evy
//
//  Created by Geoffroy Lesage on 2/7/2024.
//

import SwiftUI

private let spaceForFirstLabel: CGFloat = 6
private let columnWidth: CGFloat = 80
private let rowHeight: CGFloat = 30
private let animationDuration: CGFloat = 0.1

private let falseAsData = "false".data(using: .utf8)!
private let trueAsData = "true".data(using: .utf8)!
/**
 * Calendar operations system
 */
enum EVYCalendarOperation {
    case select(index: Int)
    case unselect(index: Int)
    case unselectRow(y: Int)
    case selectRow(y: Int)
    case unselectColumn(x: Int)
    case selectColumn(x: Int)
}

struct EVYCalendarOperationKey: EnvironmentKey {
    static let defaultValue: (EVYCalendarOperation) -> Void = { _  in }
}

extension EnvironmentValues {
    var operate: (EVYCalendarOperation) -> Void {
        get { self[EVYCalendarOperationKey.self] }
        set { self[EVYCalendarOperationKey.self] = newValue }
    }
}

/**
 * Main views
 */
struct EVYCalendarTimeslots: View {
    @Environment(\.operate) private var operate
    
    let rows: Int
    let columns: Int
    
    let primaryTimeslotsData: [EVYCalendarTimeslotData]
    let secondaryTimeslotsData: [EVYCalendarTimeslotData]
    
    var body: some View {
        HStack(spacing: .zero) {
            ForEach(0..<columns, id: \.self) { x in
                VStack(alignment: .leading, spacing: .zero) {
                    ForEach(0..<rows, id: \.self) { y in
                        let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: rows)
                        let fill: Color = primaryTimeslotsData[relevantIndex].selected ?
                            Constants.actionColor :
                                (secondaryTimeslotsData[relevantIndex].selected ?
                                 Constants.inactiveBackground :
                                    Constants.tappableClearColor
                        )
                        Rectangle()
                            .fill(fill)
                            .frame(height: rowHeight)
                            .frame(width: columnWidth)
                            .onTapGesture(perform: {
                                if primaryTimeslotsData[relevantIndex].selected {
                                    operate(EVYCalendarOperation.unselect(index: relevantIndex))
                                } else {
                                    operate(EVYCalendarOperation.select(index: relevantIndex))
                                }
                            })
                    }
                }.overlay(
                    Divider()
                        .opacity(Constants.borderOpacity)
                        .frame(maxWidth: Constants.thinBorderWidth, maxHeight: .infinity)
                        .background(Constants.inactiveBackground), alignment: .leading
                )
            }
        }
    }
}

struct EVYCalendarLabel {
    let value: String
    var full: Bool
}

struct EVYAxisLabel: View {
    let label: String
    @State var full: Bool
    let action: (_ full: Bool) -> Void
    
    var body: some View {
        Button(action: {
            action(full)
            full.toggle()
        }, label: {
            let label = label.count > 0 ? label : "-"
            EVYTextView(label, style: full ? .action : .info)
        })
        .frame(height: rowHeight)
        .frame(width: columnWidth)
    }
}

enum EVYAxisType {
    case x
    case y
}
struct EVYCalendarAxisView: View {
    @Environment(\.operate) private var operate
    let type: EVYAxisType
    let labels: [EVYCalendarLabel]
    @Binding var offset: CGPoint
    
    var body: some View {
        switch type {
        case .x:
            ScrollView([.horizontal]) {
                HStack(spacing: .zero) {
                    ForEach(labels.indices, id: \.self)  { x in
                        EVYAxisLabel(label: labels[x].value,
                                     full: labels[x].full,
                                     action: { full in
                            if full {
                                operate(EVYCalendarOperation.unselectColumn(x: x))
                            } else {
                                operate(EVYCalendarOperation.selectColumn(x: x))
                            }
                        })
                    }
                }.offset(x: offset.x)
            }.scrollDisabled(true)
        case .y:
            VStack(spacing: .zero) {
                // empty corner
                Color.clear.frame(width: .zero, height: rowHeight-spaceForFirstLabel)
                ScrollView([.vertical]) {
                    // Offset based on scroll position but also add to center correctly
                    VStack(spacing: .zero) {
                        ForEach(labels.indices, id: \.self)  { y in
                            EVYAxisLabel(label: labels[y].value,
                                         full: labels[y].full,
                                         action: { full in
                                if full {
                                    operate(EVYCalendarOperation.unselectRow(y: y))
                                } else {
                                    operate(EVYCalendarOperation.selectRow(y: y))
                                }
                            })
                        }
                    }.offset(y: offset.y-spaceForFirstLabel)
                }.scrollDisabled(true)
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
    private var yLabels: [EVYCalendarLabel]
    private var xLabels: [EVYCalendarLabel]
    
    private let primarySource: String
    private let secondaryTimeslotsData: [EVYCalendarTimeslotData]
    
    @State private var scrollOffset = CGPoint.zero
    @State private var calendarTimeslots: EVYCalendarTimeslots
    
    init(primary: String, secondary: String) {
        self.primarySource = primary
        self.secondaryTimeslotsData = getTimeslotsData(secondary)

        let primaryTimeslotsData = getTimeslotsData(primary)
        
        // Build the initial axis labels
        xLabels = primaryTimeslotsData
            .filter({ $0.y == 0})
            .map({ EVYCalendarLabel(value: String($0.header),
                                    full: false) })
        yLabels = primaryTimeslotsData
            .filter({ $0.x == 0})
            .map({ EVYCalendarLabel(value: String($0.start_label),
                                    full: false) })
        
        // Mark the axis labels as full if needed
        for x in 0..<xLabels.count {
            let selectedInColumn = primaryTimeslotsData
                .filter({ $0.x == x && $0.selected})
            guard selectedInColumn.count == yLabels.count else {
                continue
            }
            xLabels[x].full = true
        }
        for y in 0..<yLabels.count {
            let selectedInColumn = primaryTimeslotsData
                .filter({ $0.y == y && $0.selected})
            guard selectedInColumn.count == xLabels.count else {
                continue
            }
            yLabels[y].full = true
        }
        
        // Append a label to yaxis to denote the end
        if !primaryTimeslotsData.isEmpty {
            yLabels.append(
                EVYCalendarLabel(value: primaryTimeslotsData.last!.end_label,
                                 full: false)
            )
        }
        
        // Build the initial calendar timeslots to display
        self.calendarTimeslots = EVYCalendarTimeslots(rows: yLabels.count-1,
                                                      columns: xLabels.count,
                                                      primaryTimeslotsData: primaryTimeslotsData,
                                                      secondaryTimeslotsData: secondaryTimeslotsData)
    }
    
    private func handleOperation(_ operation: EVYCalendarOperation) {
        let sourceProps = EVY.parsePropsFromText(primarySource)
        switch operation {
        case .select(let index):
            let props = "{\(sourceProps)[\(index)].selected}"
            try! EVY.updateData(trueAsData, at: props)

        case .unselect(let index):
            let props = "{\(sourceProps)[\(index)].selected}"
            try! EVY.updateData(falseAsData, at: props)

        case .selectRow(let y):
            for x in 0..<xLabels.count {
                let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: yLabels.count-1)
                let props = "{\(sourceProps)[\(relevantIndex)].selected}"
                try! EVY.updateData(trueAsData, at: props)
            }
        case .unselectRow(let y):
            for x in 0..<xLabels.count {
                let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: yLabels.count-1)
                let props = "{\(sourceProps)[\(relevantIndex)].selected}"
                try! EVY.updateData(falseAsData, at: props)
            }
            
        case .selectColumn(let x):
            for y in 0..<yLabels.count-1 {
                let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: yLabels.count-1)
                let props = "{\(sourceProps)[\(relevantIndex)].selected}"
                try! EVY.updateData(trueAsData, at: props)
            }
            
        case .unselectColumn(let x):
            for y in 0..<yLabels.count-1 {
                let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: yLabels.count-1)
                let props = "{\(sourceProps)[\(relevantIndex)].selected}"
                try! EVY.updateData(falseAsData, at: props)
            }
        }
        
        withAnimation(.linear(duration: animationDuration)) {
            calendarTimeslots = EVYCalendarTimeslots(rows: yLabels.count-1,
                                                     columns: xLabels.count,
                                                     primaryTimeslotsData: getTimeslotsData(primarySource),
                                                     secondaryTimeslotsData: secondaryTimeslotsData)
        }
    }
    
    var body: some View {
        HStack(spacing: .zero) {
            EVYCalendarAxisView(type: .y, labels: yLabels, offset: $scrollOffset)
            VStack(spacing: .zero) {
                EVYCalendarAxisView(type: .x, labels: xLabels, offset: $scrollOffset)
                ScrollViewReader { _ in
                    ScrollView([.vertical, .horizontal]) {
                        calendarTimeslots
                            .background( GeometryReader { geo in
                                Color.clear
                                    .preference(key: ViewOffsetKey.self,
                                                value: geo.frame(in: .named("scroll")).origin)
                            })
                            .onPreferenceChange(ViewOffsetKey.self) { value in
                                scrollOffset = value
                            }
                    }.scrollIndicators(.hidden)
                }.coordinateSpace(name: "scroll")
            }
        }.environment(\.operate) { calendarOperation in
            handleOperation(calendarOperation)
        }
    }
}

private func calculateIndex(x: Int, y: Int, numberOfRows: Int) -> Int {
    return y+(x*(numberOfRows))
}

private func getTimeslotsData(_ source: String) -> [EVYCalendarTimeslotData] {
    do {
        let timeslotsJSON = try EVY.getDataFromText(source)
        return try JSONDecoder().decode(
            [EVYCalendarTimeslotData].self,
            from: timeslotsJSON.toString().data(using: .utf8)!
        )
    } catch {
        return []
    }
}

#Preview {
    let pickup = DataConstants.pickupTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "pickupTimeslots", data: pickup)
    
    let delivery = DataConstants.deliveryTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "deliveryTimeslots", data: delivery)

    return EVYCalendar(primary: "{pickupTimeslots}", secondary: "{deliveryTimeslots}")
}
