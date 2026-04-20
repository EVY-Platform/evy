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
    static let defaultValue: (EVYCalendarOperation) -> Void = { _ in }
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
	@Environment(\.colorScheme) var colorScheme
    
    let rows: Int
    let columns: Int
    
    let primaryTimeslotsData: [EVYCalendarTimeslotData]
    let secondaryTimeslotsData: [EVYCalendarTimeslotData]
    
    var body: some View {
		let actionColor = colorScheme == .light ? Constants.actionColor : .white
        HStack(spacing: .zero) {
            ForEach(0..<columns, id: \.self) { x in
                VStack(alignment: .leading, spacing: .zero) {
                    ForEach(0..<rows, id: \.self) { y in
                        let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: rows)
						let fill: Color = primaryTimeslotsData[relevantIndex].selected ?
							actionColor :
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
    static var defaultValue: CGPoint { CGPoint.zero }
    static func reduce(value: inout CGPoint, nextValue: () -> CGPoint) {
        value.x += nextValue().x
        value.y += nextValue().y
    }
}

struct EVYCalendar: View {
    private let primarySource: String
    private let secondarySource: String
    
    @State private var yLabels: [EVYCalendarLabel]
    @State private var xLabels: [EVYCalendarLabel]
    @State private var scrollOffset = CGPoint.zero
    @State private var calendarTimeslots: EVYCalendarTimeslots
    
    init(primary: String, secondary: String) {
        primarySource = primary
        secondarySource = secondary

        let (xl, yl, timeslots) = Self.buildCalendarData(
            primarySource: primary,
            secondarySource: secondary
        )
        _xLabels = State(initialValue: xl)
        _yLabels = State(initialValue: yl)
        _calendarTimeslots = State(initialValue: timeslots)
    }
    
    private static func buildCalendarData(
        primarySource: String,
        secondarySource: String
    ) -> ([EVYCalendarLabel], [EVYCalendarLabel], EVYCalendarTimeslots) {
        let primaryTimeslotsData = getTimeslotsData(primarySource)
        let secondaryTimeslotsData = getTimeslotsData(secondarySource)
        
        var xLabels = primaryTimeslotsData
            .filter { $0.y == 0 }
            .map {
                EVYCalendarLabel(value: String($0.header),
                                 full: false)
            }
        var yLabels = primaryTimeslotsData
            .filter { $0.x == 0 }
            .map {
                EVYCalendarLabel(value: String($0.start_label),
                                 full: false)
            }
        
        for x in 0..<xLabels.count {
            let selectedInColumn = primaryTimeslotsData
                .filter { $0.x == x && $0.selected }
            guard selectedInColumn.count == yLabels.count else {
                continue
            }
            xLabels[x].full = true
        }
        for y in 0..<yLabels.count {
            let selectedInColumn = primaryTimeslotsData
                .filter { $0.y == y && $0.selected }
            guard selectedInColumn.count == xLabels.count else {
                continue
            }
            yLabels[y].full = true
        }
        
        if !primaryTimeslotsData.isEmpty {
            yLabels.append(
                EVYCalendarLabel(value: primaryTimeslotsData.last!.end_label,
                                 full: false)
            )
        }
        
        let timeslots = EVYCalendarTimeslots(
            rows: max(yLabels.count - 1, 0),
            columns: xLabels.count,
            primaryTimeslotsData: primaryTimeslotsData,
            secondaryTimeslotsData: secondaryTimeslotsData
        )
        
        return (xLabels, yLabels, timeslots)
    }
    
    private func reloadData(animated: Bool = false) {
        let (xl, yl, timeslots) = Self.buildCalendarData(
            primarySource: primarySource,
            secondarySource: secondarySource
        )
        if animated {
            withAnimation(.linear(duration: animationDuration)) {
                xLabels = xl
                yLabels = yl
                calendarTimeslots = timeslots
            }
        } else {
            xLabels = xl
            yLabels = yl
            calendarTimeslots = timeslots
        }
    }
    
    private func handleOperation(_ operation: EVYCalendarOperation) {
        let sourceProps = EVY.parsePropsFromText(primarySource)
        switch operation {
        case let .select(index):
            let props = "{\(sourceProps)[\(index)].selected}"
            try! EVY.updateData(trueAsData, at: props)

        case let .unselect(index):
            let props = "{\(sourceProps)[\(index)].selected}"
            try! EVY.updateData(falseAsData, at: props)

        case let .selectRow(y):
            for x in 0..<xLabels.count {
                let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: yLabels.count-1)
                let props = "{\(sourceProps)[\(relevantIndex)].selected}"
                try! EVY.updateData(trueAsData, at: props)
            }
        case let .unselectRow(y):
            for x in 0..<xLabels.count {
                let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: yLabels.count-1)
                let props = "{\(sourceProps)[\(relevantIndex)].selected}"
                try! EVY.updateData(falseAsData, at: props)
            }
            
        case let .selectColumn(x):
            for y in 0..<yLabels.count-1 {
                let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: yLabels.count-1)
                let props = "{\(sourceProps)[\(relevantIndex)].selected}"
                try! EVY.updateData(trueAsData, at: props)
            }
            
        case let .unselectColumn(x):
            for y in 0..<yLabels.count-1 {
                let relevantIndex = calculateIndex(x: x, y: y, numberOfRows: yLabels.count-1)
                let props = "{\(sourceProps)[\(relevantIndex)].selected}"
                try! EVY.updateData(falseAsData, at: props)
            }
        }
        
        reloadData(animated: true)
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
        }
        .environment(\.operate) { calendarOperation in
            handleOperation(calendarOperation)
        }
        .onReceive(NotificationCenter.default.publisher(for: .evyDataUpdated)) { _ in
            reloadData()
        }
    }
}

private func calculateIndex(x: Int, y: Int, numberOfRows: Int) -> Int {
    y+(x*(numberOfRows))
}

@MainActor
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
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.createItem()

		let timeslotsData = (try? EVY.data.get(key: "timeslots"))?.data
        let previewScopeId = EVYDraft.createMergeScopeId(flowId: "preview", entityKey: "timeslots")
        EVY.data.activeDraftScopeId = previewScopeId
		EVY.ensureDraftExists(
            variableName: "pickup_timeslots",
            initialData: timeslotsData,
            scopeId: previewScopeId
        )
		EVY.ensureDraftExists(
            variableName: "delivery_timeslots",
            initialData: timeslotsData,
            scopeId: previewScopeId
        )

		return EVYCalendar(primary: "{pickup_timeslots}",
					   secondary: "{delivery_timeslots}")
	}
}
