//
//  EVYTimeslotPicker.swift
//  EVY
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import SwiftUI

let timeslotWidth: CGFloat = Constants.base * 18

struct EVYTimeslot {
  let timeslot: String
  let available: Bool
}

struct EVYTimeslotDate {
  let header: String
  let subtitle: String
  let timeslots: [EVYTimeslot]
}

struct EVYTimeslotColumn: View {
  let timeslotDate: EVYTimeslotDate
  let numberOfTimeslotsPerDay: Int

  var body: some View {
    VStack {
      EVYTextView(timeslotDate.header)
      EVYTextView(timeslotDate.subtitle)
      ForEach((0...(numberOfTimeslotsPerDay - 1)), id: \.self) { timeslotIndex in
        if timeslotDate.timeslots.count - 1 < timeslotIndex {
          EVYRectangle.fixedWidth(
            content: EVYTextView("-"),
            style: .clear,
            width: timeslotWidth)
        } else {
          let t = timeslotDate.timeslots[timeslotIndex]
          EVYRectangle.fixedWidth(
            content: EVYTextView(t.timeslot),
            style: t.available ? .primary : .secondary,
            width: timeslotWidth)
        }
      }
    }
  }
}

struct EVYTimeslotPicker: View {
  private struct HeightPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
      value = max(value, nextValue())
    }
  }

  private let content: TimeslotPickerRowContent
  private let source: String
  private let sourceDataChangeWatch: EVYDataChangeWatch

  @State private var timeslotDates: [EVYTimeslotDate]
  @State private var selectedGroupIndex: Int = 0
  @State private var tabViewHeight: CGFloat = 0

  init(content: TimeslotPickerRowContent, source: String) {
    self.content = content
    self.source = source
    sourceDataChangeWatch = EVYDataChangeWatch(source)
    _timeslotDates = State(initialValue: Self.buildDates(content: content, source: source))
  }

  @MainActor
  private static func buildDates(
    content: TimeslotPickerRowContent, source: String
  ) -> [EVYTimeslotDate] {
    EVYDatetime.buildTimeslotPickerDates(
      headerFormat: content.header_format,
      headerSubtitle: content.header_subtitle,
      timeslotFormat: content.timeslot_format,
      selections: EVYDatetime.readTimeslots(source)
    )
  }

  private var numberOfTimeslotsPerDay: Int {
    timeslotDates.map { $0.timeslots.count }.max() ?? 0
  }

  private func timeslotGroupView(groupedDays: [[EVYTimeslotDate]], index: Int) -> some View {
    HStack {
      ForEach(groupedDays[index].indices, id: \.self) { dayIndex in
        EVYTimeslotColumn(
          timeslotDate: groupedDays[index][dayIndex],
          numberOfTimeslotsPerDay: numberOfTimeslotsPerDay
        )
        .padding(.horizontal, Constants.padding)
      }
    }
  }

  private func timeslotHeightMeasurement(groupedDays: [[EVYTimeslotDate]]) -> some View {
    VStack(spacing: 0) {
      ForEach(groupedDays.indices, id: \.self) { index in
        timeslotGroupView(groupedDays: groupedDays, index: index)
          .fixedSize(horizontal: false, vertical: true)
          .background(
            GeometryReader { geo in
              Color.clear.preference(
                key: HeightPreferenceKey.self,
                value: geo.size.height)
            })
      }
    }
    .opacity(0)
    .allowsHitTesting(false)
    .accessibilityHidden(true)
    .frame(height: 0)
  }

  var body: some View {
    if timeslotDates.isEmpty || numberOfTimeslotsPerDay <= 0 {
      EmptyView()
    } else {
      let groupedDays = timeslotDates.chunked(with: 4)

      VStack {
        timeslotHeightMeasurement(groupedDays: groupedDays)

        TabView(selection: $selectedGroupIndex) {
          ForEach(groupedDays.indices, id: \.self) { index in
            timeslotGroupView(groupedDays: groupedDays, index: index)
          }
        }
        .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
        .frame(height: max(tabViewHeight, 1))

        EVYCarouselIndicator(
          indices: (0...groupedDays.count - 1),
          selectionIndex: selectedGroupIndex,
          color: .black)
      }
      .onPreferenceChange(HeightPreferenceKey.self) { height in
        let roundedHeight = ceil(height)
        if roundedHeight > 0, tabViewHeight != roundedHeight {
          tabViewHeight = roundedHeight
        }
      }
      .onReceive(NotificationCenter.default.publisher(for: .evyDataChanged)) { notification in
        guard let notificationKey = notification.object as? String else { return }
        if dataChangeKey(notificationKey, affects: sourceDataChangeWatch) {
          timeslotDates = Self.buildDates(content: content, source: source)
        }
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
      let content = try? JSONDecoder().decode(TimeslotPickerRowContent.self, from: data)
    {
      EVYTimeslotPicker(content: content, source: "{pickup_selection}")
    }
  }
}
