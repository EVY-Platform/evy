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

struct EVYCalendarViewState: Equatable {
  let xLabels: [EVYCalendarLabel]
  let yLabels: [EVYCalendarLabel]
  let rows: Int
  let columns: Int
  let slots: [EVYCalendarSlot]
}

struct EVYCalendar: View {
  private let content: CalendarRowViewData
  private let source: String
  private let destination: String
  private let calendarState: EVYState<EVYCalendarViewState>

  @State private var scrollOffset = CGPoint.zero

  init(content: CalendarRowViewData, source: String, destination: String) {
    self.content = content
    self.source = source
    self.destination = destination
    calendarState = EVYState(
      watches: [destination, source],
      setter: { Self.buildCalendarData(content: content, source: source, destination: destination) }
    )
  }

  private static func buildCalendarData(
    content: CalendarRowViewData,
    source: String,
    destination: String
  ) -> EVYCalendarViewState {
    let primarySelections = EVYDatetime.readTimeslots(destination)
    let secondarySelections = EVYDatetime.readTimeslots(source)

    let slots = EVYDatetime.buildCalendarSlots(
      row: content,
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
    if let firstSlot = slots.first,
      let firstDate = try? Date(firstSlot.dateTimeISO, strategy: .iso8601)
    {
      yLabels.append(
        EVYCalendarLabel(
          value: EVYDatetime.formattedCalendarTimeLabel(
            dateString: EVYDatetime.isoCalendarDateString(from: firstDate),
            timeString: content.end_time,
            format: content.timeslot_format
          ),
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

    // Wrap the write in `withAnimation` so the synchronous notification-driven
    // `EVYState.value` mutation falls inside the animation transaction.
    withAnimation(.linear(duration: animationDuration)) {
      writePrimarySelections(selections)
    }
  }

  private func dateTimes(forRow y: Int) -> [String] {
    calendarState.value.slots.filter { $0.y == y }.map { $0.dateTimeISO }
  }

  private func dateTimes(forColumn x: Int) -> [String] {
    calendarState.value.slots.filter { $0.x == x }.map { $0.dateTimeISO }
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
    EVYDatetime.readTimeslots(destination)
  }

  private func writePrimarySelections(_ selections: [String]) {
    guard let data = try? JSONEncoder().encode(selections) else { return }
    try? EVY.updateData(data, at: destination)
  }

  var body: some View {
    HStack(spacing: .zero) {
      EVYCalendarAxisView(type: .y, labels: calendarState.value.yLabels, offset: $scrollOffset)
      VStack(spacing: .zero) {
        EVYCalendarAxisView(type: .x, labels: calendarState.value.xLabels, offset: $scrollOffset)
        ScrollViewReader { _ in
          ScrollView([.vertical, .horizontal]) {
            EVYCalendarTimeslots(
              rows: calendarState.value.rows,
              columns: calendarState.value.columns,
              slots: calendarState.value.slots
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
  }
}

private func calculateIndex(x: Int, y: Int, numberOfRows: Int) -> Int {
  y + (x * numberOfRows)
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
      variableName: EVYPreviewMockData.calendarPreviewDestinationVariable,
      initialData: EVYPreviewMockData.calendarPickupSelection.data(using: .utf8),
      scopeId: previewScopeId
    )
    EVY.ensureDraftExists(
      variableName: EVYPreviewMockData.calendarPreviewSourceVariable,
      initialData: EVYPreviewMockData.calendarDeliverySelection.data(using: .utf8),
      scopeId: previewScopeId
    )
  }

  var body: some View {
    if let data = EVYPreviewMockData.calendarContentJSON.data(using: .utf8),
      let content = try? JSONDecoder().decode(CalendarRowViewData.self, from: data)
    {
      EVYCalendar(
        content: content,
        source: EVYPreviewMockData.calendarPreviewSource,
        destination: EVYPreviewMockData.calendarPreviewDestination)
    } else {
      Text("Unable to build calendar preview")
    }
  }
}
