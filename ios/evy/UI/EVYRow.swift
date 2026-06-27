//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct EVYRow: View, Identifiable {
  private let ref: EVYRowRef
  let datum: EVYJson?

  @State private var rowReloadID = 0

  init(rowId: String, datum: EVYJson? = nil) {
    self.ref = .id(rowId)
    self.datum = datum
  }

  init(row: UI_Row, datum: EVYJson? = nil) {
    self.ref = .inline(row)
    self.datum = datum
  }

  init(ref: EVYRowRef, datum: EVYJson? = nil) {
    self.ref = ref
    self.datum = datum
  }

  var id: String { ref.id }

  @ViewBuilder
  var body: some View {
    switch ref {
    case .id(let rowId):
      EVYResolvedRow(ref: ref, datum: datum)
        .id(rowReloadID)
        .onReceive(NotificationCenter.default.publisher(for: .evyDataChanged)) { notification in
          guard
            let change = notification.userInfo?[EVYDataChange.userInfoKey] as? EVYDataChange,
            change.namespace == EVYNamespace.evy,
            change.resource == EVYCoreResource.rows.rawValue,
            change.id == rowId
          else { return }
          rowReloadID += 1
        }
    case .inline:
      EVYResolvedRow(ref: ref, datum: datum)
    }
  }
}

@MainActor
func bootstrapRowDraft(row: UI_Row, scopeId: String?) {
  guard !row.destination.isEmpty else { return }
  let destinationProps = EVY.parsePropsFromText(row.destination)
  let variableName = parseFunctionCall(destinationProps)?.functionArgs ?? destinationProps
  guard !variableName.isEmpty else { return }
  let initialData: Data? =
    [.inlinePicker, .calendar].contains(row.type)
    ? "[]".data(using: .utf8)
    : nil
  EVY.ensureDraftExists(
    variableName: variableName,
    initialData: initialData,
    scopeId: scopeId
  )
}

private struct EVYResolvedRow: View {
  private let ref: EVYRowRef
  let datum: EVYJson?

  private let contentRow: UI_Row?
  private let childRef: EVYRowRef?
  private let childRefs: [EVYRowRef]
  private let isVisible: EVYState<Bool>

  @Environment(\.navigate) private var navigate
  @Environment(\.evyDraftScopeId) private var evyDraftScopeId
  @State private var presentedSheetRef: EVYRowRef?

  init(ref: EVYRowRef, datum: EVYJson? = nil) {
    self.ref = ref
    self.datum = datum
    switch ref {
    case .id(let rowId):
      let storedRow = EVYRowStore.row(id: rowId)
      self.contentRow = storedRow?.uiRow()
      self.childRef = storedRow?.childRowId.map(EVYRowRef.id)
      self.childRefs = storedRow?.childrenRowIds.map(EVYRowRef.id) ?? []
      let visibleExpr = storedRow?.visible.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      self.isVisible = Self.makeVisibilityState(for: visibleExpr)
    case .inline(let row):
      self.contentRow = row
      self.childRef = row.child.map(EVYRowRef.inline)
      self.childRefs = row.children.map(EVYRowRef.inline)
      let visibleExpr = row.visible.trimmingCharacters(in: .whitespacesAndNewlines)
      self.isVisible = Self.makeVisibilityState(for: visibleExpr)
    }
  }

  var body: some View {
    if let contentRow {
      if isVisible.value {
        if let payload = try? UI_RowPayload.from(row: contentRow) {
          renderedRow(for: payload, contentRow: contentRow)
            .sheet(item: $presentedSheetRef) { sheetRef in
              ScrollView {
                EVYRow(ref: sheetRef)
              }
              .padding(.vertical, Constants.majorPadding)
              .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
              .background(Color.white.ignoresSafeArea())
              .presentationDetents([.medium, .large])
              .presentationDragIndicator(.visible)
              .presentationBackground(.white)
            }
            .onAppear { bootstrapRowDraft(row: contentRow, scopeId: evyDraftScopeId) }
        }
      } else {
        EmptyView()
      }
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
    guard let contentRow else { return false }
    return !contentRow.actions.isEmpty && contentRow.type != .button
  }

  private func runActions(contentRow: UI_Row) {
    EVYActionRunner.run(
      actions: contentRow.actions,
      datum: datum,
      childRef: childRef,
      show: { ref in presentedSheetRef = ref },
      navigate: navigate
    )
  }

  @ViewBuilder
  private func renderedRow(for payload: UI_RowPayload, contentRow: UI_Row) -> some View {
    if shouldUseGenericActionTap {
      rowView(for: payload, contentRow: contentRow)
        .contentShape(Rectangle())
        .onTapGesture { runActions(contentRow: contentRow) }
    } else {
      rowView(for: payload, contentRow: contentRow)
    }
  }

  @ViewBuilder
  private func rowView(for payload: UI_RowPayload, contentRow: UI_Row) -> some View {
    switch payload {
    case .button(let v, _, _, _):
      EVYButtonRow(view: v, action: { runActions(contentRow: contentRow) })
    case .calendar(let v, let s, let d, _):
      EVYCalendarRow(view: v, source: s, destination: d)
    case .columnContainer(let v, _, _, _):
      EVYColumnContainerRow(view: v, childRefs: childRefs)
    case .dropdown(let v, let s, let d, _):
      EVYDropdownRow(view: v, source: s, destination: d)
    case .heading(let v, _, _, _):
      EVYHeadingRow(view: v)
    case .inlinePicker(let v, let s, let d, _):
      EVYInlinePickerRow(view: v, source: s, destination: d)
    case .inputList(let v, let s, _, _):
      EVYInputListRow(view: v, source: s)
    case .input(let v, _, let d, _):
      EVYInputRow(view: v, destination: d, isInteractive: contentRow.actions.isEmpty)
    case .listContainer(let v, let s, _, _):
      EVYListContainerRow(view: v, source: s, childRef: childRef, childRefs: childRefs)
    case .listItem(let v, _, _, _):
      EVYListItemRow(view: v)
    case .map(let v, _, _, _):
      EVYMapRow(view: v)
    case .search(let v, let s, _, _):
      EVYSearchRow(view: v, source: s, childRef: childRef)
    case .photoGallery(let v, let s, _, _):
      EVYPhotoGalleryRow(view: v, source: s)
    case .selectPhoto(let v, _, let d, _):
      EVYSelectPhotoRow(view: v, destination: d)
    case .selectSegmentContainer(let v, _, _, _):
      EVYSelectSegmentContainerRow(view: v, childRefs: childRefs)
    case .timeslotPicker(let v, let s, _, _):
      EVYTimeslotPickerRow(view: v, source: s)
    case .text(let v, _, _, _):
      EVYTextRow(view: v)
    case .textAction(let v, _, _, _):
      EVYTextActionRow(view: v)
    case .textExpand(let v, _, _, _):
      EVYTextExpandRow(view: v)
    case .textArea(let v, _, let d, _):
      EVYTextAreaRow(view: v, destination: d)
    case .textSelect(let v, _, let d, _):
      if let row = EVYTextSelectRow(view: v, destination: d) {
        row
      } else {
        EmptyView()
      }
    }
  }
}
