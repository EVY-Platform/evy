//
//  EVYCalendar.swift
//  evy
//

import SwiftUI

private let animationDuration: CGFloat = 0.1

enum EVYCalendarOperation {
    case select(dateTime: String)
    case unselect(dateTime: String)
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

struct EVYCalendarTimeslots: View {
    @Environment(\.operate) private var operate
    @Environment(\.colorScheme) var colorScheme

    let rows: Int
    let columns: Int
    let slots: [EVYCalendarSlot]

    var body: some View {
        let actionColor = colorScheme == .light ? Constants.actionColor : .white
        HStack(spacing: .zero) {
            ForEach(0..<columns, id: \.self) { x in
                VStack(alignment: .leading, spacing: .zero) {
                    ForEach(0..<rows, id: \.self) { y in
                        let index = calculateIndex(x: x, y: y, numberOfRows: rows)
                        let slot = slots[index]
                        let fill: Color =
                            slot.isPrimarySelected
                            ? actionColor
                            : (slot.isSecondarySelected
                                ? Constants.inactiveBackground : Constants.tappableClearColor)
                        Rectangle()
                            .fill(fill)
                            .frame(height: rowHeight)
                            .frame(width: columnWidth)
                            .onTapGesture {
                                if slot.isPrimarySelected {
                                    operate(EVYCalendarOperation.unselect(dateTime: slot.dateTimeISO))
                                } else {
                                    operate(EVYCalendarOperation.select(dateTime: slot.dateTimeISO))
                                }
                            }
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

struct ViewOffsetKey: PreferenceKey {
    static var defaultValue: CGPoint { CGPoint.zero }
    static func reduce(value: inout CGPoint, nextValue: () -> CGPoint) {
        value.x += nextValue().x
        value.y += nextValue().y
    }
}

struct EVYCalendarViewState {
    let xLabels: [EVYCalendarLabel]
    let yLabels: [EVYCalendarLabel]
    let rows: Int
    let columns: Int
    let slots: [EVYCalendarSlot]
}

struct EVYCalendar: View {
    private let content: CalendarRowContent

    @State private var state: EVYCalendarViewState
    @State private var scrollOffset = CGPoint.zero

    init(content: CalendarRowContent) {
        self.content = content
        _state = State(initialValue: Self.buildCalendarData(content: content))
    }

    private static func buildCalendarData(content: CalendarRowContent) -> EVYCalendarViewState {
        let primarySelections = readSelections(content.primary)
        let secondarySelections = readSelections(content.secondary)

        let intervalMinutes = content.timeslot_interval_minutes > 0 ? content.timeslot_interval_minutes : 30
        let labelIntervalMinutes = content.label_interval_minutes > 0 ? content.label_interval_minutes : 60
        let headerFormat = content.header_format.isEmpty ? "EEE d" : content.header_format

        let slots = buildCalendarSlots(
            startTime: content.start_time,
            endTime: content.end_time,
            intervalMinutes: intervalMinutes,
            labelIntervalMinutes: labelIntervalMinutes,
            headerFormat: headerFormat,
            primarySelections: primarySelections,
            secondarySelections: secondarySelections
        )

        let numRows = slots.filter { $0.x == 0 }.count
        let numColumns = slots.isEmpty ? 0 : (slots.map { $0.x }.max() ?? 0) + 1

        var columnHeaders: [Int: String] = [:]
        for slot in slots where columnHeaders[slot.x] == nil {
            columnHeaders[slot.x] = slot.header
        }
        var xLabels = (0..<numColumns).map { x in
            EVYCalendarLabel(value: columnHeaders[x] ?? "", full: false)
        }

        var yLabels: [EVYCalendarLabel] = (0..<numRows).map { y in
            let label = slots.first { $0.x == 0 && $0.y == y }?.timeLabel ?? ""
            return EVYCalendarLabel(value: label, full: false)
        }
        let endParts = content.end_time.split(separator: ":").compactMap { Int($0) }
        if endParts.count >= 2 {
            yLabels.append(EVYCalendarLabel(
                value: "\(endParts[0]):\(String(format: "%02d", endParts[1]))",
                full: false
            ))
        }

        let primarySet = Set(primarySelections)
        for x in 0..<numColumns {
            let columnSlots = slots.filter { $0.x == x }
            if !columnSlots.isEmpty && columnSlots.allSatisfy({ primarySet.contains($0.dateTimeISO) }) {
                xLabels[x].full = true
            }
        }
        for y in 0..<numRows {
            let rowSlots = slots.filter { $0.y == y }
            if rowSlots.count == numColumns && !rowSlots.isEmpty
                && rowSlots.allSatisfy({ primarySet.contains($0.dateTimeISO) })
            {
                yLabels[y].full = true
            }
        }

        return EVYCalendarViewState(
            xLabels: xLabels,
            yLabels: yLabels,
            rows: numRows,
            columns: numColumns,
            slots: slots
        )
    }

    private func reloadData(animated: Bool = false) {
        let newState = Self.buildCalendarData(content: content)
        if animated {
            withAnimation(.linear(duration: animationDuration)) {
                state = newState
            }
        } else {
            state = newState
        }
    }

    private func handleOperation(_ operation: EVYCalendarOperation) {
        var selections = readPrimarySelections()

        switch operation {
        case .select(let dateTime):
            selections = adding([dateTime], to: selections)
        case .unselect(let dateTime):
            selections = removing([dateTime], from: selections)
        case .selectRow(let y):
            selections = adding(dateTimes(forRow: y), to: selections)
        case .unselectRow(let y):
            selections = removing(dateTimes(forRow: y), from: selections)
        case .selectColumn(let x):
            selections = adding(dateTimes(forColumn: x), to: selections)
        case .unselectColumn(let x):
            selections = removing(dateTimes(forColumn: x), from: selections)
        }

        writePrimarySelections(selections)
        reloadData(animated: true)
    }

    private func dateTimes(forRow y: Int) -> [String] {
        state.slots.filter { $0.y == y }.map { $0.dateTimeISO }
    }

    private func dateTimes(forColumn x: Int) -> [String] {
        state.slots.filter { $0.x == x }.map { $0.dateTimeISO }
    }

    private func adding(_ values: [String], to selections: [String]) -> [String] {
        var result = selections
        let existing = Set(selections)
        for v in values where !existing.contains(v) { result.append(v) }
        return result
    }

    private func removing(_ values: [String], from selections: [String]) -> [String] {
        let toRemove = Set(values)
        return selections.filter { !toRemove.contains($0) }
    }

    private func readPrimarySelections() -> [String] {
        readSelections(content.primary)
    }

    private func writePrimarySelections(_ selections: [String]) {
        guard let data = try? JSONEncoder().encode(selections) else { return }
        try? EVY.updateData(data, at: content.primary)
    }

    var body: some View {
        HStack(spacing: .zero) {
            EVYCalendarAxisView(type: .y, labels: state.yLabels, offset: $scrollOffset)
            VStack(spacing: .zero) {
                EVYCalendarAxisView(type: .x, labels: state.xLabels, offset: $scrollOffset)
                ScrollViewReader { _ in
                    ScrollView([.vertical, .horizontal]) {
                        EVYCalendarTimeslots(
                            rows: state.rows,
                            columns: state.columns,
                            slots: state.slots
                        )
                        .background(
                            GeometryReader { geo in
                                Color.clear
                                    .preference(
                                        key: ViewOffsetKey.self,
                                        value: geo.frame(in: .named("scroll")).origin)
                            }
                        )
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
        .onReceive(NotificationCenter.default.publisher(for: .evyDataChanged)) { _ in
            reloadData()
        }
    }
}

private func calculateIndex(x: Int, y: Int, numberOfRows: Int) -> Int {
    y + (x * numberOfRows)
}

@MainActor
private func readSelections(_ source: String) -> [String] {
    guard let json = try? EVY.getDataFromText(source),
          let data = json.toString().data(using: .utf8) else { return [] }
    return (try? JSONDecoder().decode([String].self, from: data)) ?? []
}

#Preview {
    EVYCalendarPreview()
}

private struct EVYCalendarPreview: View {
    init() {
        EVYPreviewMockData.seedCommon()
        let previewScopeId = EVYDraft.createMergeScopeId(flowId: "preview", entityKey: "item")
        EVY.draftStore.activeScopeId = previewScopeId
        EVY.ensureDraftExists(
            variableName: "pickup_selection",
            initialData: EVYPreviewMockData.calendarPickupSelection.data(using: .utf8),
            scopeId: previewScopeId
        )
        EVY.ensureDraftExists(
            variableName: "delivery_selection",
            initialData: EVYPreviewMockData.calendarDeliverySelection.data(using: .utf8),
            scopeId: previewScopeId
        )
    }

    var body: some View {
        if let data = EVYPreviewMockData.calendarContentJSON.data(using: .utf8),
           let content = try? JSONDecoder().decode(CalendarRowContent.self, from: data) {
            EVYCalendar(content: content)
        }
    }
}
