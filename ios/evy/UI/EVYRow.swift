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
  private let hidesTitle: Bool

  @State private var storedRow: EVYStoredRow?

  init(rowId: String, datum: EVYJson? = nil, hidesTitle: Bool = false) {
    self.init(ref: .id(rowId), datum: datum, hidesTitle: hidesTitle)
  }

  init(row: UI_Row, datum: EVYJson? = nil, hidesTitle: Bool = false) {
    self.init(ref: .inline(row), datum: datum, hidesTitle: hidesTitle)
  }

  init(ref: EVYRowRef, datum: EVYJson? = nil, hidesTitle: Bool = false) {
    self.ref = ref
    self.datum = datum
    self.hidesTitle = hidesTitle
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
        ref: ref, storedRow: storedRow, datum: datum, hidesTitle: hidesTitle
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
        ref: ref, storedRow: nil, datum: datum, hidesTitle: hidesTitle)
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
  let variableName = EVY.parseFunctionCall(destinationProps)?.functionArgs ?? destinationProps
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
  case .emptyArray, .stringArray:
    return "[]".data(using: .utf8)
  case .emptyStringScalar, .scalarString:
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
private func uiRowWithHiddenTitle(_ row: UI_Row) -> UI_Row {
  row.with(title: "")
}

private struct EVYResolvedRow: View {
  private let ref: EVYRowRef
  private let storedRow: EVYStoredRow?
  let datum: EVYJson?
  private let hidesTitle: Bool

  @Environment(\.action) private var action
  @Environment(\.sheetDismiss) private var sheetDismiss
  @Environment(\.evyScope) private var evyScope
  @State private var presentedSheetRef: EVYRowRef?
  @State private var isVisible = EVYState<Bool>(staticString: true)

  init(
    ref: EVYRowRef,
    storedRow: EVYStoredRow?,
    datum: EVYJson? = nil,
    hidesTitle: Bool = false
  ) {
    self.ref = ref
    self.storedRow = storedRow
    self.datum = datum
    self.hidesTitle = hidesTitle
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
    if hidesTitle {
      return uiRowWithHiddenTitle(row)
    }
    return row
  }

  private var childRef: EVYRowRef? {
    switch ref {
    case .id:
      guard storedRow?.type == .search else { return nil }
      return storedRow?.childRowId.map(EVYRowRef.id)
    case .inline(let row):
      guard row.type == .search else { return nil }
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

  // Keep in sync with `rowView(for:)` cases that wire their own tap callbacks.
  // Omitting a type here causes the generic whole-row tap to double-fire with the row's tap.
  private static let selfHandlingRowTypes: Set<EVYRowType> = [
    .button,
    .timeslotPicker,
    .calendar,
    .selectPhoto,
    .textSelect,
    .textExpand,
    .photoGallery,
    .tabContainer,
    .inlinePicker,
  ]

  private var shouldUseGenericActionTap: Bool {
    guard let contentRow else { return false }
    return !contentRow.actions.tap.isEmpty
      && !Self.selfHandlingRowTypes.contains(contentRow.type)
  }

  private func runActions(
    trigger: EVYRowActionTrigger = .tap,
    contentRow: UI_Row,
    datum: EVYJson? = nil,
    rowOperation: EVYRowOperationHandler? = nil
  ) {
    let actions = trigger.actions(in: contentRow.actions)
    EVYActionRunner.run(
      actions: actions,
      datum: datum ?? self.datum,
      show: { rowId in
        guard EVYRowStore.row(id: rowId) != nil else {
          throw EVYError.invalidData(context: "show could not resolve row id \(rowId)")
        }
        presentedSheetRef = .id(rowId)
      },
      rowOperation: rowOperation,
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
    if !contentRow.actions.swipeLeft.isEmpty {
      EVYSwipeableRow(
        swipeIdentity: EVYSwipeRowIdentity.make(rowId: contentRow.id, datum: datum),
        swipeLabel: contentRow.swipeLabel,
        onExecute: {
          runActions(trigger: .swipeLeft, contentRow: contentRow)
        }
      ) {
        tappedOrPlainRow(for: payload, contentRow: contentRow)
      }
    } else {
      tappedOrPlainRow(for: payload, contentRow: contentRow)
    }
  }

  @ViewBuilder
  private func tappedOrPlainRow(for payload: UI_RowPayload, contentRow: UI_Row) -> some View {
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
      EVYCalendarRow(
        view: view,
        onSlotTapped: { tappedSlot, rowOperation in
          runActions(
            contentRow: contentRow,
            datum: .string(tappedSlot),
            rowOperation: rowOperation
          )
        },
        onRowTapped: { dateTimeISOs, rowOperation in
          runActions(
            trigger: .tapRow,
            contentRow: contentRow,
            datum: .array(dateTimeISOs.map { .string($0) }),
            rowOperation: rowOperation
          )
        },
        onColumnTapped: { dateTimeISOs, rowOperation in
          runActions(
            trigger: .tapColumn,
            contentRow: contentRow,
            datum: .array(dateTimeISOs.map { .string($0) }),
            rowOperation: rowOperation
          )
        }
      )
    case .horizontalContainer(let view, _):
      EVYHorizontalContainerRow(view: view, childRefs: childRefs)
    case .dropdown(let view, _):
      EVYDropdownRow(view: view)
    case .heading(let view, _):
      EVYHeadingRow(view: view)
    case .inlinePicker(let view, _):
      EVYInlinePickerRow(view: view) { option, rowOperation in
        runActions(contentRow: contentRow, datum: option, rowOperation: rowOperation)
      }
    case .inputList(let view, _):
      EVYInputListRow(view: view)
    case .input(let view, _):
      EVYInputRow(view: view, isInteractive: contentRow.actions.tap.isEmpty)
    case .verticalContainer(let view, _):
      EVYVerticalContainerRow(view: view, childRefs: childRefs)
    case .listItem(let view, _):
      EVYListItemRow(view: view)
    case .map(let view, _):
      EVYMapRow(view: view)
    case .search(let view, _):
      EVYSearchRow(view: view, childRef: childRef)
    case .photoGallery(let view, _):
      EVYPhotoGalleryRow(view: view) { imageId, rowOperation in
        runActions(
          contentRow: contentRow,
          datum: .string(imageId),
          rowOperation: rowOperation
        )
      }
    case .selectPhoto(let view, _):
      EVYSelectPhotoRow(view: view) { rowOperation in
        runActions(contentRow: contentRow, rowOperation: rowOperation)
      } onDeletePhotoTapped: { rowOperation in
        runActions(trigger: .delete, contentRow: contentRow, rowOperation: rowOperation)
      }
    case .tabContainer(let view, _):
      EVYTabContainerRow(view: view, childRefs: childRefs) { segmentIndex, rowOperation in
        runActions(
          contentRow: contentRow,
          datum: .string(String(segmentIndex)),
          rowOperation: rowOperation
        )
      }
    case .timeslotPicker(let view, _):
      EVYTimeslotPickerRow(view: view) { tappedSlot, rowOperation in
        runActions(contentRow: contentRow, datum: tappedSlot, rowOperation: rowOperation)
      }
    case .text(let view, _):
      EVYTextRow(view: view)
    case .textAction(let view, _):
      EVYTextActionRow(view: view)
    case .textExpand(let view, _):
      EVYTextExpandRow(
        view: view,
        rowId: contentRow.id,
        onExpandTapped: { runActions(contentRow: contentRow) }
      )
    case .textArea(let view, _):
      EVYTextAreaRow(view: view)
    case .textSelect(let view, _):
      if let row = EVYTextSelectRow(
        view: view,
        onTap: { value, rowOperation in
          runActions(contentRow: contentRow, datum: value, rowOperation: rowOperation)
        })
      {
        row
      } else {
        EmptyView()
      }
    }
  }
}

/// Sheet presented by `{show(rowId)}`: child row `title` is the main header (like a page title).
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
        EVYRow(ref: sheetRef, hidesTitle: true)
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
