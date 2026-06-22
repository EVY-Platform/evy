//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct EVYRow: View, Identifiable {
  private struct PresentedSheetRow: Identifiable {
    let row: UI_Row
    var id: String { row.id }
  }

  let row: UI_Row
  let datum: EVYJson?
  private let isVisible: EVYState<Bool>

  @Environment(\.navigate) private var navigate
  @State private var presentedSheetRow: PresentedSheetRow?

  init(row: UI_Row, datum: EVYJson? = nil) {
    self.row = row
    self.datum = datum
    let visibleExpr = row.visible.trimmingCharacters(in: .whitespacesAndNewlines)
    isVisible = Self.makeVisibilityState(for: visibleExpr)
  }

  var id: String { row.id }

  var body: some View {
    if isVisible.value {
      if let payload = try? UI_RowPayload.from(row: row) {
        renderedRow(for: payload)
          .sheet(item: $presentedSheetRow) { presented in
            ScrollView {
              EVYRow(row: presented.row)
            }
            .padding(.vertical, Constants.majorPadding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.white.ignoresSafeArea())
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackground(.white)
          }
      }
    } else {
      EmptyView()
    }
  }

  private static func makeVisibilityState(for visibleExpr: String) -> EVYState<Bool> {
    if visibleExpr.isEmpty {
      return EVYState(staticString: true)
    }
    let evaluateVisibility = { (try? EVY.evaluateFromText(visibleExpr)) ?? false }
    let watchTargets = EVY.watchTargets(for: visibleExpr)
    if watchTargets.isEmpty {
      return EVYState(staticString: evaluateVisibility())
    }
    return EVYState(watches: watchTargets, setter: evaluateVisibility)
  }

  private var shouldUseGenericActionTap: Bool {
    !row.actions.isEmpty && row.type != .button
  }

  private func runActions() {
    EVYActionRunner.run(
      actions: row.actions,
      row: row,
      datum: datum,
      show: { child in presentedSheetRow = PresentedSheetRow(row: child) },
      navigate: navigate
    )
  }

  @ViewBuilder
  private func renderedRow(for payload: UI_RowPayload) -> some View {
    if shouldUseGenericActionTap {
      rowView(for: payload)
        .contentShape(Rectangle())
        .onTapGesture(perform: runActions)
    } else {
      rowView(for: payload)
    }
  }

  @ViewBuilder
  private func rowView(for payload: UI_RowPayload) -> some View {
    switch payload {
    case .button(let v, _, _, _): EVYButtonRow(view: v, action: runActions)
    case .calendar(let v, _, _, _): EVYCalendarRow(view: v)
    case .columnContainer(let v, _, _, _): EVYColumnContainerRow(view: v)
    case .dropdown(let v, let s, let d, _): EVYDropdownRow(view: v, source: s, destination: d)
    case .inlinePicker(let v, let s, let d, _):
      EVYInlinePickerRow(view: v, source: s, destination: d)
    case .inputList(let v, let s, _, _): EVYInputListRow(view: v, source: s)
    case .input(let v, _, let d, _):
      EVYInputRow(view: v, destination: d, isInteractive: row.actions.isEmpty)
    case .listContainer(let v, let s, _, _): EVYListContainerRow(view: v, source: s)
    case .listItem(let v, _, _, _): EVYListItemRow(view: v)
    case .map(let v, _, _, _): EVYMapRow(view: v)
    case .search(let v, let s, _, _): EVYSearchRow(view: v, source: s)
    case .photoGallery(let v, let s, _, _): EVYPhotoGalleryRow(view: v, source: s)
    case .selectPhoto(let v, _, let d, _): EVYSelectPhotoRow(view: v, destination: d)
    case .selectSegmentContainer(let v, _, _, _): EVYSelectSegmentContainerRow(view: v)
    case .timeslotPicker(let v, let s, _, _): EVYTimeslotPickerRow(view: v, source: s)
    case .text(let v, _, _, _): EVYTextRow(view: v)
    case .textAction(let v, _, _, _): EVYTextActionRow(view: v)
    case .textExpand(let v, _, _, _): EVYTextExpandRow(view: v)
    case .textArea(let v, _, let d, _): EVYTextAreaRow(view: v, destination: d)
    case .textSelect(let v, _, let d, _):
      if let row = EVYTextSelectRow(view: v, destination: d) {
        row
      } else {
        EmptyView()
      }
    }
  }
}
