//
//  EVYCalendar.swift
//  evy
//

import SwiftUI

private let animationDuration: CGFloat = 0.1

private struct EVYCalendarTimeslots: View {
  @Environment(\.colorScheme) var colorScheme

  let rows: Int
  let columns: Int
  let slots: [EVYCalendarSlot]
  let onSlotTapped: ((String) -> Void)?

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
                onSlotTapped?(slot.dateTimeISO)
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

private struct ViewOffsetKey: PreferenceKey {
  static var defaultValue: CGPoint { CGPoint.zero }
  static func reduce(value: inout CGPoint, nextValue: () -> CGPoint) {
    value.x += nextValue().x
    value.y += nextValue().y
  }
}

private struct EVYCalendarViewState: Equatable {
  let xLabels: [EVYCalendarLabel]
  let yLabels: [EVYCalendarLabel]
  let rows: Int
  let columns: Int
  let slots: [EVYCalendarSlot]
}

struct EVYCalendar: View {
  private let content: CalendarRowViewData
  private let calendarState: EVYState<EVYCalendarViewState>
  private let onSlotTapped: ((String) -> Void)?
  private let onRowTapped: (([String]) -> Void)?
  private let onColumnTapped: (([String]) -> Void)?

  @State private var scrollOffset = CGPoint.zero

  init(
    content: CalendarRowViewData,
    onSlotTapped: ((String) -> Void)? = nil,
    onRowTapped: (([String]) -> Void)? = nil,
    onColumnTapped: (([String]) -> Void)? = nil
  ) {
    self.content = content
    self.onSlotTapped = onSlotTapped
    self.onRowTapped = onRowTapped
    self.onColumnTapped = onColumnTapped
    calendarState = EVYState(
      watches: [
        content.destination,
        content.source,
        content.secondary ?? "",
      ],
      setter: { Self.buildCalendarData(content: content) }
    )
  }

  private static func buildCalendarData(
    content: CalendarRowViewData
  ) -> EVYCalendarViewState {
    let source = content.source
    let destination = content.destination
    let secondary = content.secondary ?? ""
    let displayTimeslots = EVYDatetime.readTimeslots(source)
    let primarySelections = EVYDatetime.readTimeslots(destination)
    let secondarySelections = EVYDatetime.readTimeslots(secondary)

    let slots = EVYDatetime.buildCalendarSlots(
      row: content,
      primarySelections: primarySelections,
      secondarySelections: secondarySelections,
      displayTimeslots: displayTimeslots
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

  private func dateTimes(forRow y: Int) -> [String] {
    calendarState.value.slots.filter { $0.y == y }.map { $0.dateTimeISO }
  }

  private func dateTimes(forColumn x: Int) -> [String] {
    calendarState.value.slots.filter { $0.x == x }.map { $0.dateTimeISO }
  }

  private static func writePrimarySelections(_ selections: [String], to destination: String) {
    guard !destination.isEmpty else { return }
    try? EVY.writeRawValue(
      EVYJson.array(selections.map { .string($0) }),
      to: destination
    )
  }

  @MainActor
  static func togglePrimarySelection(dateTimeISO: String, destination: String) {
    guard !destination.isEmpty else { return }
    let selections = EVYDatetime.readTimeslots(destination)
    let updated = EVYSelectionHelpers.toggledIdentifier(dateTimeISO, in: selections)
    withAnimation(.linear(duration: animationDuration)) {
      writePrimarySelections(updated, to: destination)
    }
  }

  @MainActor
  static func togglePrimarySelection(dateTimeISOs: [String], destination: String) {
    guard !destination.isEmpty else { return }
    let selections = EVYDatetime.readTimeslots(destination)
    let updated = EVYSelectionHelpers.toggledIdentifiers(dateTimeISOs, in: selections)
    withAnimation(.linear(duration: animationDuration)) {
      writePrimarySelections(updated, to: destination)
    }
  }

  @MainActor
  static func applyPrimarySelection(value: EVYJson, destination: String) throws {
    switch value {
    case .string(let dateTimeISO):
      togglePrimarySelection(dateTimeISO: dateTimeISO, destination: destination)
    case .array(let elements):
      let dateTimeISOs = try elements.map { element in
        guard case .string(let dateTimeISO) = element else {
          throw EVYError.invalidData(context: "calendar select expects string datums")
        }
        return dateTimeISO
      }
      togglePrimarySelection(dateTimeISOs: dateTimeISOs, destination: destination)
    default:
      throw EVYError.invalidData(context: "calendar select expects string or array datum")
    }
  }

  var body: some View {
    HStack(spacing: .zero) {
      EVYCalendarAxisView(
        type: .y,
        labels: calendarState.value.yLabels,
        offset: $scrollOffset,
        onLabelTapped: { index in onRowTapped?(dateTimes(forRow: index)) }
      )
      VStack(spacing: .zero) {
        EVYCalendarAxisView(
          type: .x,
          labels: calendarState.value.xLabels,
          offset: $scrollOffset,
          onLabelTapped: { index in onColumnTapped?(dateTimes(forColumn: index)) }
        )
        ScrollViewReader { _ in
          ScrollView([.vertical, .horizontal]) {
            EVYCalendarTimeslots(
              rows: calendarState.value.rows,
              columns: calendarState.value.columns,
              slots: calendarState.value.slots,
              onSlotTapped: onSlotTapped
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
      variableName: EVYPreviewMockData.calendarPreviewSecondaryVariable,
      initialData: EVYPreviewMockData.calendarDeliverySelection.data(using: .utf8),
      scopeId: previewScopeId
    )
  }

  var body: some View {
    if let data = EVYPreviewMockData.calendarPreviewContentJSON.data(using: .utf8),
      let content = try? JSONDecoder().decode(CalendarRowViewData.self, from: data)
    {
      EVYCalendar(content: content)
    } else {
      Text("Unable to build calendar preview")
    }
  }
}
