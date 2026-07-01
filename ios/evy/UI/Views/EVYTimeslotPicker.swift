//
//  EVYTimeslotPicker.swift
//  EVY
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import SwiftUI

let timeslotWidth: CGFloat = Constants.base * 18

struct EVYTimeslot: Equatable {
  let timeslot: String
  let available: Bool
  let dateTimeISO: String
  let isSelected: Bool

  init(timeslot: String, available: Bool, dateTimeISO: String = "", isSelected: Bool = false) {
    self.timeslot = timeslot
    self.available = available
    self.dateTimeISO = dateTimeISO
    self.isSelected = isSelected
  }
}

struct EVYTimeslotDate: Equatable {
  let header: String
  let subtitle: String
  let timeslots: [EVYTimeslot]
}

struct EVYTimeslotColumn: View {
  let timeslotDate: EVYTimeslotDate
  let numberOfTimeslotsPerDay: Int
  let onSelect: ((String) -> Void)?

  var body: some View {
    VStack {
      EVYTextView(timeslotDate.header)
      EVYTextView(timeslotDate.subtitle)
      ForEach(0..<numberOfTimeslotsPerDay, id: \.self) { timeslotIndex in
        if timeslotDate.timeslots.count <= timeslotIndex {
          EVYRectangle.fixedWidth(
            content: EVYTextView("-"),
            style: .clear,
            width: timeslotWidth)
        } else {
          let t = timeslotDate.timeslots[timeslotIndex]
          EVYRectangle.fixedWidth(
            content: EVYTextView(t.timeslot),
            style: t.isSelected ? .primary : (t.available ? .secondary : .clear),
            width: timeslotWidth
          )
          .contentShape(Rectangle())
          .onTapGesture {
            onSelect?(t.dateTimeISO)
          }
        }
      }
    }
  }
}

struct EVYTimeslotPicker: View {
  private static let timeslotRowHeight: CGFloat = 40
  private static let columnTextLineHeight: CGFloat = 20
  private static let columnStackSpacing: CGFloat = 8

  private let destination: String
  private let timeslotDates: EVYState<[EVYTimeslotDate]>

  @State private var selectedGroupIndex: Int = 0

  init(content: TimeslotPickerRowViewData, source: String, destination: String) {
    self.destination = destination
    timeslotDates = EVYState(
      watches: [source, destination],
      setter: { Self.buildDates(content: content, source: source, destination: destination) }
    )
  }

  @MainActor
  private static func buildDates(
    content: TimeslotPickerRowViewData,
    source: String,
    destination: String
  ) -> [EVYTimeslotDate] {
    EVYDatetime.buildTimeslotPickerDates(
      row: content,
      availableSelections: EVYDatetime.readTimeslots(source),
      selectedTimeslot: EVYDatetime.readTimeslot(destination)
    )
  }

  private func selectTimeslot(_ dateTimeISO: String) {
    guard !destination.isEmpty else { return }
    try? EVY.writeRawValue(dateTimeISO, to: destination)
  }

  private var numberOfTimeslotsPerDay: Int {
    timeslotDates.value.map { $0.timeslots.count }.max() ?? 0
  }

  private var gridHeight: CGFloat {
    guard numberOfTimeslotsPerDay > 0 else { return 0 }
    let rowCount = CGFloat(numberOfTimeslotsPerDay)
    let itemCount = rowCount + 2
    let spacingTotal = (itemCount - 1) * Self.columnStackSpacing
    return Self.columnTextLineHeight * 2 + rowCount * Self.timeslotRowHeight + spacingTotal
  }

  private func timeslotGroupView(groupedDays: [[EVYTimeslotDate]], index: Int) -> some View {
    HStack {
      ForEach(groupedDays[index].indices, id: \.self) { dayIndex in
        EVYTimeslotColumn(
          timeslotDate: groupedDays[index][dayIndex],
          numberOfTimeslotsPerDay: numberOfTimeslotsPerDay,
          onSelect: selectTimeslot
        )
        .padding(.horizontal, Constants.padding)
      }
    }
  }

  var body: some View {
    if timeslotDates.value.isEmpty || numberOfTimeslotsPerDay <= 0 {
      EmptyView()
    } else {
      let groupedDays = timeslotDates.value.chunked(with: 4)

      VStack {
        TabView(selection: $selectedGroupIndex) {
          ForEach(groupedDays.indices, id: \.self) { index in
            timeslotGroupView(groupedDays: groupedDays, index: index)
          }
        }
        .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
        .frame(height: max(gridHeight, 1))

        EVYCarouselIndicator(
          indices: (0...groupedDays.count - 1),
          selectionIndex: selectedGroupIndex,
          color: .black)
      }
    }
  }
}

#Preview {
  EVYTimeslotPickerPreview()
}

private struct EVYTimeslotPickerPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
    let previewScopeId = EVYDraft.createMergeScopeId(flowId: "preview", entityKey: "item")
    EVY.draftStore.activeScopeId = previewScopeId
    EVY.ensureDraftExists(
      variableName: "pickup_selection",
      initialData: EVYPreviewMockData.calendarPickupSelection.data(using: .utf8),
      scopeId: previewScopeId
    )
  }

  var body: some View {
    if let data = EVYPreviewMockData.calendarContentJSON.data(using: .utf8),
      let content = try? JSONDecoder().decode(TimeslotPickerRowViewData.self, from: data)
    {
      EVYTimeslotPicker(
        content: content,
        source: "{pickup_selection}",
        destination: "{selected_timeslot}")
    }
  }
}
