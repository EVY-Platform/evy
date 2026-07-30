//
//  forEachRow.swift
//  evy
//

import Foundation

/// Visits every stored row reachable from a page (rows + footer, recursing into
/// `children_row_ids`, then `child_row_id`, then `sheet_row_id`). Cycle-safe via visited-id tracking.
@MainActor
func forEachStoredRow(
  inPageId pageId: String,
  from store: EVYDataStore = EVY.publicStore,
  visitor: (EVYStoredRow) -> Void
) {
  guard let page = EVYPageStore.page(id: pageId, from: store) else { return }
  var visitedRowIds = Set<String>()
  for rowId in page.row_ids {
    visitStoredRow(id: rowId, from: store, visitedRowIds: &visitedRowIds, visitor: visitor)
  }
  if let footer_row_id = page.footer_row_id {
    visitStoredRow(id: footer_row_id, from: store, visitedRowIds: &visitedRowIds, visitor: visitor)
  }
}

@MainActor
private func visitStoredRow(
  id: String,
  from store: EVYDataStore,
  visitedRowIds: inout Set<String>,
  visitor: (EVYStoredRow) -> Void
) {
  guard !visitedRowIds.contains(id),
    let storedRow = EVYRowStore.row(id: id, from: store)
  else { return }
  visitedRowIds.insert(id)
  visitor(storedRow)
  for childId in storedRow.children_row_ids {
    visitStoredRow(id: childId, from: store, visitedRowIds: &visitedRowIds, visitor: visitor)
  }
  if let childId = storedRow.child_row_id {
    visitStoredRow(id: childId, from: store, visitedRowIds: &visitedRowIds, visitor: visitor)
  }
  if let sheetId = storedRow.sheet_row_id {
    visitStoredRow(id: sheetId, from: store, visitedRowIds: &visitedRowIds, visitor: visitor)
  }
}
