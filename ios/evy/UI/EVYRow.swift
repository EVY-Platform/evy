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

  @State private var storedRow: EVYStoredRow?

  init(rowId: String, datum: EVYJson? = nil) {
    self.ref = .id(rowId)
    self.datum = datum
    _storedRow = State(initialValue: EVYRowStore.row(id: rowId))
  }

  init(row: UI_Row, datum: EVYJson? = nil) {
    self.ref = .inline(row)
    self.datum = datum
    _storedRow = State(initialValue: nil)
  }

  init(ref: EVYRowRef, datum: EVYJson? = nil) {
    self.ref = ref
    self.datum = datum
    switch ref {
    case .id(let rowId):
      _storedRow = State(initialValue: EVYRowStore.row(id: rowId))
    case .inline:
      _storedRow = State(initialValue: nil)
    }
  }

  var id: String { ref.id }

  @ViewBuilder
  var body: some View {
    switch ref {
    case .id(let rowId):
      EVYResolvedRow(ref: ref, storedRow: storedRow, datum: datum)
        .onReceive(NotificationCenter.default.publisher(for: .evyDataChanged)) { notification in
          guard
            let change = EVYDataChange.from(notification),
            change.matches(
              namespace: EVYNamespace.evy,
              resource: EVYCoreResource.rows.rawValue,
              id: rowId
            )
          else { return }
          let latestRow = EVYRowStore.row(id: rowId)
          if storedRow != latestRow {
            storedRow = latestRow
          }
        }
    case .inline:
      EVYResolvedRow(ref: ref, storedRow: nil, datum: datum)
    }
  }
}

@MainActor
private func rowDestination(from payload: UI_RowPayload) -> String? {
  switch payload {
  case .calendar(let view, _): return view.destination
  case .dropdown(let view, _): return view.destination
  case .inlinePicker(let view, _): return view.destination
  case .input(let view, _): return view.destination
  case .search(let view, _): return view.destination
  case .selectPhoto(let view, _): return view.destination
  case .textArea(let view, _): return view.destination
  case .textSelect(let view, _): return view.destination
  case .timeslotPicker(let view, _): return view.destination
  default: return nil
  }
}

@MainActor
func bootstrapRowDraft(row: UI_Row, scopeId: String?, payload: UI_RowPayload? = nil) {
  let unwrappedPayload: UI_RowPayload?
  if let existingPayload = payload {
    unwrappedPayload = existingPayload
  } else {
    unwrappedPayload = try? UI_RowPayload.from(row: row)
  }

  guard let finalPayload = unwrappedPayload,
    let destination = rowDestination(from: finalPayload)?.trimmingCharacters(
      in: .whitespacesAndNewlines),
    !destination.isEmpty
  else { return }

  let destinationProps = EVY.parsePropsFromText(destination)
  let variableName = parseFunctionCall(destinationProps)?.functionArgs ?? destinationProps
  guard !variableName.isEmpty else { return }

  let initialData: Data?
  switch row.type {
  case .inlinePicker, .calendar:
    initialData = "[]".data(using: .utf8)
  case .timeslotPicker:
    initialData = "\"\"".data(using: .utf8)
  default:
    initialData = nil
  }

  EVY.ensureDraftExists(
    variableName: variableName,
    initialData: initialData,
    scopeId: scopeId
  )
}

private struct EVYResolvedRow: View {
  private let ref: EVYRowRef
  private let storedRow: EVYStoredRow?
  let datum: EVYJson?

  @Environment(\.navigate) private var navigate
  @Environment(\.evyDraftScopeId) private var evyDraftScopeId
  @State private var presentedSheetRef: EVYRowRef?
  @State private var isVisible = EVYState<Bool>(staticString: true)

  init(ref: EVYRowRef, storedRow: EVYStoredRow?, datum: EVYJson? = nil) {
    self.ref = ref
    self.storedRow = storedRow
    self.datum = datum
    _isVisible = State(
      initialValue: Self.makeVisibilityState(
        for: Self.visibleExpression(ref: ref, storedRow: storedRow)
      )
    )
  }

  private var contentRow: UI_Row? {
    switch ref {
    case .id:
      return storedRow?.uiRow()
    case .inline(let row):
      return row
    }
  }

  private var childRef: EVYRowRef? {
    switch ref {
    case .id:
      return storedRow?.childRowId.map(EVYRowRef.id)
    case .inline(let row):
      return row.child.map(EVYRowRef.inline)
    }
  }

  private var childRefs: [EVYRowRef] {
    switch ref {
    case .id:
      return storedRow?.childrenRowIds.map(EVYRowRef.id) ?? []
    case .inline(let row):
      return row.children.map(EVYRowRef.inline)
    }
  }

  private var visibleExpression: String {
    Self.visibleExpression(ref: ref, storedRow: storedRow)
  }

  private static func visibleExpression(ref: EVYRowRef, storedRow: EVYStoredRow?) -> String {
    switch ref {
    case .id:
      return storedRow?.visible.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    case .inline(let row):
      return row.visible.trimmingCharacters(in: .whitespacesAndNewlines)
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
            .onAppear {
              refreshVisibilityState()
              bootstrapRowDraft(row: contentRow, scopeId: evyDraftScopeId, payload: payload)
            }
            .onChange(of: visibleExpression) { _, _ in
              refreshVisibilityState()
            }
        }
      } else {
        EmptyView()
      }
    }
  }

  private func refreshVisibilityState() {
    isVisible = Self.makeVisibilityState(for: visibleExpression)
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
    case .button(let view, _):
      EVYButtonRow(view: view, action: { runActions(contentRow: contentRow) })
    case .calendar(let view, _):
      EVYCalendarRow(view: view)
    case .columnContainer(let view, _):
      EVYColumnContainerRow(view: view, childRefs: childRefs)
    case .dropdown(let view, _):
      EVYDropdownRow(view: view)
    case .heading(let view, _):
      EVYHeadingRow(view: view)
    case .inlinePicker(let view, _):
      EVYInlinePickerRow(view: view)
    case .inputList(let view, _):
      EVYInputListRow(view: view)
    case .input(let view, _):
      EVYInputRow(view: view, isInteractive: contentRow.actions.isEmpty)
    case .listContainer(let view, _):
      EVYListContainerRow(view: view, childRef: childRef, childRefs: childRefs)
    case .listItem(let view, _):
      EVYListItemRow(view: view)
    case .map(let view, _):
      EVYMapRow(view: view)
    case .search(let view, _):
      EVYSearchRow(view: view, childRef: childRef)
    case .photoGallery(let view, _):
      EVYPhotoGalleryRow(view: view)
    case .selectPhoto(let view, _):
      EVYSelectPhotoRow(view: view)
    case .selectSegmentContainer(let view, _):
      EVYSelectSegmentContainerRow(view: view, childRefs: childRefs)
    case .timeslotPicker(let view, _):
      EVYTimeslotPickerRow(view: view)
    case .text(let view, _):
      EVYTextRow(view: view)
    case .textAction(let view, _):
      EVYTextActionRow(view: view)
    case .textExpand(let view, _):
      EVYTextExpandRow(view: view)
    case .textArea(let view, _):
      EVYTextAreaRow(view: view)
    case .textSelect(let view, _):
      if let row = EVYTextSelectRow(view: view) {
        row
      } else {
        EmptyView()
      }
    }
  }
}
