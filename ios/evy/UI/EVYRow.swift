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
  private let titleOverride: String?

  @State private var storedRow: EVYStoredRow?

  init(rowId: String, datum: EVYJson? = nil, titleOverride: String? = nil) {
    self.ref = .id(rowId)
    self.datum = datum
    self.titleOverride = titleOverride
    _storedRow = State(initialValue: EVYRowStore.row(id: rowId))
  }

  init(row: UI_Row, datum: EVYJson? = nil, titleOverride: String? = nil) {
    self.ref = .inline(row)
    self.datum = datum
    self.titleOverride = titleOverride
    _storedRow = State(initialValue: nil)
  }

  init(ref: EVYRowRef, datum: EVYJson? = nil, titleOverride: String? = nil) {
    self.ref = ref
    self.datum = datum
    self.titleOverride = titleOverride
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
      EVYResolvedRow(
        ref: ref, storedRow: storedRow, datum: datum, titleOverride: titleOverride
      )
      .onEVYRecordChange(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.rows.rawValue,
        id: rowId
      ) {
        let latestRow = EVYRowStore.row(id: rowId)
        if storedRow != latestRow {
          storedRow = latestRow
        }
      }
    case .inline:
      EVYResolvedRow(
        ref: ref, storedRow: nil, datum: datum, titleOverride: titleOverride)
    }
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
    let destination = finalPayload.destination?.trimmingCharacters(
      in: .whitespacesAndNewlines),
    !destination.isEmpty
  else { return }

  let destinationProps = EVY.parsePropsFromText(destination)
  let variableName = parseFunctionCall(destinationProps)?.functionArgs ?? destinationProps
  guard !variableName.isEmpty else { return }

  let initialData =
    initialDraftData(for: row, destination: destination)
    ?? defaultBootstrapData(for: row.type)

  EVY.ensureDraftExists(
    variableName: variableName,
    initialData: initialData,
    scopeId: scopeId
  )
}

private enum RowDraftShape {
  case scalarString
  case stringArray
  case emptyStringScalar
  case emptyArray
}

private func draftShape(for type: EVYRowType) -> RowDraftShape? {
  switch type {
  case .input, .textArea, .dropdown:
    return .scalarString
  case .inlinePicker:
    return .stringArray
  case .timeslotPicker:
    return .emptyStringScalar
  case .calendar:
    return .emptyArray
  default:
    return nil
  }
}

private func defaultBootstrapData(for type: EVYRowType) -> Data? {
  switch draftShape(for: type) {
  case .emptyArray:
    return "[]".data(using: .utf8)
  case .emptyStringScalar:
    return "\"\"".data(using: .utf8)
  default:
    return nil
  }
}

@MainActor
private func initialDraftData(for row: UI_Row, destination: String) -> Data? {
  guard let shape = draftShape(for: row.type) else { return nil }
  guard !row.initial.isEmpty else { return nil }

  let rawValue: EVYJson
  switch shape {
  case .scalarString:
    rawValue = .string(row.initial)
  case .stringArray:
    rawValue = .array([.string(row.initial)])
  default:
    return nil
  }
  return try? EVY.prepareDraftData(value: rawValue, destination: destination).data
}

@MainActor
private func uiRowWithTitle(_ row: UI_Row, title: String) -> UI_Row {
  guard let encoded = try? JSONEncoder().encode(row),
    var json = try? JSONSerialization.jsonObject(with: encoded) as? [String: Any]
  else { return row }
  json["title"] = title
  guard let data = try? JSONSerialization.data(withJSONObject: json),
    let decoded = try? JSONDecoder().decode(UI_Row.self, from: data)
  else { return row }
  return decoded
}

private struct EVYResolvedRow: View {
  private let ref: EVYRowRef
  private let storedRow: EVYStoredRow?
  let datum: EVYJson?
  private let titleOverride: String?

  @Environment(\.action) private var action
  @Environment(\.sheetDismiss) private var sheetDismiss
  @Environment(\.evyScope) private var evyScope
  @State private var presentedSheetRef: EVYRowRef?
  @State private var isVisible = EVYState<Bool>(staticString: true)

  init(
    ref: EVYRowRef,
    storedRow: EVYStoredRow?,
    datum: EVYJson? = nil,
    titleOverride: String? = nil
  ) {
    self.ref = ref
    self.storedRow = storedRow
    self.datum = datum
    self.titleOverride = titleOverride
    _isVisible = State(
      initialValue: Self.makeVisibilityState(
        for: Self.visibleExpression(ref: ref, storedRow: storedRow)
      )
    )
  }

  private var contentRow: UI_Row? {
    let row: UI_Row?
    switch ref {
    case .id:
      row = storedRow?.uiRow()
    case .inline(let inlineRow):
      row = inlineRow
    }
    guard let row else { return nil }
    if let titleOverride {
      return uiRowWithTitle(row, title: titleOverride)
    }
    return row
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
              EVYSheetOverlay(
                sheetRef: sheetRef,
                onDismiss: { presentedSheetRef = nil }
              )
            }
            .onAppear {
              refreshVisibilityState()
              bootstrapRowDraft(row: contentRow, scopeId: evyScope.draftScopeId, payload: payload)
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
    return !contentRow.actions.isEmpty
      && contentRow.type != .button
      && contentRow.type != .timeslotPicker
  }

  private func runActions(contentRow: UI_Row, prepare: (() -> Void)? = nil) {
    EVYActionRunner.run(
      actions: contentRow.actions,
      datum: datum,
      childRef: childRef,
      show: { ref in presentedSheetRef = ref },
      prepare: prepare,
      action: { operation in
        if case .close = operation, let sheetDismiss {
          sheetDismiss()
          return
        }
        action(operation)
      }
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
      EVYTimeslotPickerRow(
        view: view,
        onTimeslotSelected: { commit in
          runActions(contentRow: contentRow, prepare: commit)
        }
      )
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

/// Sheet presented by `{show()}`: child row `title` is the main header (like a page title).
private struct EVYSheetOverlay: View {
  let sheetRef: EVYRowRef
  let onDismiss: () -> Void

  /// Refreshed when the sheet root row updates (e.g. web builder title edit).
  @State private var sheetTitleTemplate: String

  init(sheetRef: EVYRowRef, onDismiss: @escaping () -> Void) {
    self.sheetRef = sheetRef
    self.onDismiss = onDismiss
    _sheetTitleTemplate = State(initialValue: Self.titleTemplate(for: sheetRef))
  }

  var body: some View {
    NavigationStack {
      ScrollView {
        EVYRow(ref: sheetRef, titleOverride: "")
          .environment(\.sheetDismiss, onDismiss)
      }
      .padding(.vertical, Constants.majorPadding)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
      .background(Color.white.ignoresSafeArea())
      .evyNavigationTitle(sheetTitleTemplate)
    }
    .presentationDetents([.medium, .large])
    .presentationDragIndicator(.visible)
    .presentationBackground(.white)
    .onEVYRecordChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.rows.rawValue,
      id: sheetRef.id
    ) {
      guard case .id = sheetRef else { return }
      let latestTitle = Self.titleTemplate(for: sheetRef)
      if sheetTitleTemplate != latestTitle {
        sheetTitleTemplate = latestTitle
      }
    }
  }

  private static func titleTemplate(for sheetRef: EVYRowRef) -> String {
    sheetRef.templateRow()?.title.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }
}
