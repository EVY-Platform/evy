//
//  EVYFlowStore.swift
//  evy
//

import Foundation

// MARK: - Stored record types (one per backend table)

struct EVYStoredFlow: Decodable, Equatable {
  let id: String
  let pageIds: [String]
}

struct EVYStoredPage: Decodable, Equatable {
  let id: String
  let title: String?
  let rowIds: [String]
  let footerRowId: String?
}

struct EVYStoredRow: Decodable, Equatable {
  let id: String
  let name: String?
  let type: EVYRowType
  let visible: String
  let data: [String: EVYJson]

  var childRowId: String? {
    guard case .string(let value) = data["child_row_id"] else { return nil }
    return value
  }

  var sheetRowId: String? {
    guard case .string(let value) = data["sheet_row_id"] else { return nil }
    return value
  }

  var childrenRowIds: [String] {
    guard case .array(let items) = data["children_row_ids"] else { return [] }
    return items.compactMap { item in
      guard case .string(let s) = item else { return nil }
      return s
    }
  }

  /// Builds a single-row `UI_Row` from this record's content.
  /// Relationship ids are intentionally NOT resolved — callers use
  /// `sheetRowId`, `childRowId` (Search only), and `childrenRowIds` to render nested rows by id.
  func uiRow() -> UI_Row? {
    var object = data.mapValues(evyJsonToAny)
    object.removeValue(forKey: "sheet_row_id")
    object.removeValue(forKey: "child_row_id")
    object.removeValue(forKey: "children_row_ids")
    object["id"] = id
    if let name { object["name"] = name }
    object["type"] = type.rawValue
    object["visible"] = visible
    guard JSONSerialization.isValidJSONObject(object),
      let encoded = try? JSONSerialization.data(withJSONObject: object)
    else { return nil }
    return try? JSONDecoder().decode(UI_Row.self, from: encoded)
  }
}

private func evyJsonToAny(_ value: EVYJson) -> Any {
  switch value {
  case .string(let v): return v
  case .int(let v): return v
  case .decimal(let v): return NSDecimalNumber(decimal: v)
  case .bool(let v): return v
  case .dictionary(let v): return v.mapValues(evyJsonToAny)
  case .array(let v): return v.map(evyJsonToAny)
  case .null: return NSNull()
  }
}

// MARK: - EVYRowRef

/// Identifies a row as either a stored id (resolved from the rows table)
/// or an in-memory value (runtime-generated rows: dynamic list items, search results).
enum EVYRowRef: Identifiable, Equatable {
  case id(String)
  case inline(UI_Row)

  var id: String {
    switch self {
    case .id(let rowId): return rowId
    case .inline(let row): return row.id
    }
  }

  static func == (lhs: EVYRowRef, rhs: EVYRowRef) -> Bool {
    lhs.id == rhs.id
  }

  /// Returns the content `UI_Row` for use as a template (e.g. Search result child).
  // used by tests
  @MainActor
  func templateRow(from store: EVYDataStore = EVY.publicStore) -> UI_Row? {
    switch self {
    case .id(let rowId): return EVYRowStore.row(id: rowId, from: store)?.uiRow()
    case .inline(let row): return row
    }
  }
}

// MARK: - EVYFlowStore (flows table)

@MainActor
enum EVYFlowStore {
  static func flowExists(id: String, from store: EVYDataStore = EVY.publicStore) -> Bool {
    (try? store.get(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.flows.rawValue,
      id: id
    )) != nil
  }

  static func flow(id: String, from store: EVYDataStore = EVY.publicStore) -> EVYStoredFlow? {
    guard
      let evyData = try? store.get(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.flows.rawValue,
        id: id
      )
    else { return nil }
    return try? JSONDecoder().decode(EVYStoredFlow.self, from: evyData.data)
  }

  static func firstPageId(
    inFlowId flowId: String,
    from store: EVYDataStore = EVY.publicStore
  ) -> String? {
    flow(id: flowId, from: store)?.pageIds.first
  }

  static func pageIds(
    inFlowId flowId: String,
    from store: EVYDataStore = EVY.publicStore
  ) -> [String] {
    flow(id: flowId, from: store)?.pageIds ?? []
  }

  /// Returns the given `pageId` only if the flow with `flowId` contains it.
  static func pageId(
    flowId: String,
    pageId: String,
    from store: EVYDataStore = EVY.publicStore
  ) -> String? {
    guard let flow = flow(id: flowId, from: store), flow.pageIds.contains(pageId) else {
      return nil
    }
    return pageId
  }

  static func createKeys(
    flowId: String,
    from store: EVYDataStore = EVY.publicStore
  ) -> Set<String> {
    guard let flow = flow(id: flowId, from: store) else { return [] }
    var keys = Set<String>()
    for pid in flow.pageIds {
      forEachStoredRow(inPageId: pid, from: store) { storedRow in
        guard let uiRow = storedRow.uiRow() else { return }
        for action in EVYRowActionTrigger.allActionLists(in: uiRow.actions) {
          for branch in [action.`true`, action.`false`] {
            // Only draft-submission creates (no inline data) define the flow's entity
            // scope. Inline creates (addresses, messages, …) must not steal it —
            // otherwise sorted().first can pick "addresses" over the items resource id
            // and item field drafts merge under the wrong root.
            if let createAction = EVYActionParser.createAction(from: branch),
              createAction.data == nil
            {
              keys.insert(createAction.resource)
            }
          }
        }
      }
    }
    return keys
  }

  static func draftScopeId(
    for route: Route,
    from store: EVYDataStore = EVY.publicStore
  ) -> String? {
    // TODO(simplify-if-and-shared-address#3): declare the flow submission entity in fixture/schema
    // instead of sorted().first over create-action resource keys.
    if let entityKey = createKeys(flowId: route.flowId, from: store).sorted().first {
      return EVYDraft.createMergeScopeId(flowId: route.flowId, entityKey: entityKey)
    }
    return "\(route.flowId):browse"
  }
}

// MARK: - EVYPageStore (pages table)

@MainActor
enum EVYPageStore {
  static func page(id: String, from store: EVYDataStore = EVY.publicStore) -> EVYStoredPage? {
    guard
      let evyData = try? store.get(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.pages.rawValue,
        id: id
      )
    else { return nil }
    return try? JSONDecoder().decode(EVYStoredPage.self, from: evyData.data)
  }
}

// MARK: - EVYRowStore (rows table)

@MainActor
enum EVYRowStore {
  static func row(id: String, from store: EVYDataStore = EVY.publicStore) -> EVYStoredRow? {
    guard
      let evyData = try? store.get(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.rows.rawValue,
        id: id
      )
    else { return nil }
    return try? JSONDecoder().decode(EVYStoredRow.self, from: evyData.data)
  }
}
