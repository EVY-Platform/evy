//
//  EVYContainerDynamicChildren.swift
//  evy
//

import Foundation

struct EVYContainerDynamicInstance: Equatable, Identifiable {
  let id: String
  let datum: EVYJson
  let displayRow: UI_Row

  static func == (lhs: EVYContainerDynamicInstance, rhs: EVYContainerDynamicInstance) -> Bool {
    lhs.id == rhs.id
  }
}

enum EVYContainerDynamicChildren {
  @MainActor
  static func instances(
    source: String?,
    childRef: EVYRowRef?,
    scopeId: String?
  ) -> [EVYContainerDynamicInstance] {
    guard let source, !source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      return []
    }
    guard let resultTemplate = childRef?.templateRow() else {
      return []
    }

    let sourceData = try? EVY.getDataFromText(source)
    guard let sourceData else {
      return []
    }

    let dataRows: [EVYJson]
    if case .array(let arrayValue) = sourceData {
      dataRows = arrayValue
    } else {
      dataRows = [sourceData]
    }

    do {
      let previous = EVY.activeCacheScopeId
      EVY.activeCacheScopeId = scopeId
      defer { EVY.activeCacheScopeId = previous }

      let formatter = try EVYDatumRowFormatter(template: resultTemplate)
      return dataRows.compactMap { datum in
        guard let (displayRow, _) = try? formatter.formattedResult(datum: datum) else {
          return nil
        }
        return EVYContainerDynamicInstance(
          id: datum.identifierValue(),
          datum: datum,
          displayRow: displayRow
        )
      }
    } catch {
      return []
    }
  }
}

struct EVYTabContainerTab: Identifiable, Equatable {
  enum Content: Equatable {
    case dynamic(EVYContainerDynamicInstance)
    case `static`(EVYRowRef)
  }

  let id: String
  let label: String
  let content: Content
}

enum EVYTabContainerTabs {
  @MainActor
  static func build(
    source: String?,
    childRef: EVYRowRef?,
    staticSegments: [String],
    staticChildRefs: [EVYRowRef],
    scopeId: String?
  ) -> [EVYTabContainerTab] {
    let dynamicInstances = EVYContainerDynamicChildren.instances(
      source: source,
      childRef: childRef,
      scopeId: scopeId
    )

    let dynamicTabs: [EVYTabContainerTab] = dynamicInstances.enumerated().map {
      index, instance in
      let title = instance.displayRow.title.trimmingCharacters(in: .whitespacesAndNewlines)
      let label = title.isEmpty ? "Item \(index + 1)" : title
      return EVYTabContainerTab(
        id: "dynamic-\(instance.id)",
        label: label,
        content: .dynamic(instance)
      )
    }

    let staticCount = min(staticSegments.count, staticChildRefs.count)
    let staticTabs: [EVYTabContainerTab] = (0..<staticCount).map { index in
      let ref = staticChildRefs[index]
      return EVYTabContainerTab(
        id: "static-\(ref.id)",
        label: staticSegments[index],
        content: .static(ref)
      )
    }

    return dynamicTabs + staticTabs
  }
}
