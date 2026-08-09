//
//  EVYActionParser+ConformanceAst.swift
//  evyTests
//

@testable import evy

extension EVYActionParser {
  static func conformanceAst(from invocation: EVYActionInvocation) -> EVYJson {
    switch invocation {
    case .close:
      return .dictionary(["fn": .string("close")])
    case .selectPhoto:
      return .dictionary(["fn": .string("select_photo")])
    case .expandPhoto:
      return .dictionary(["fn": .string("expand_photo")])
    case .deletePhoto:
      return .dictionary(["fn": .string("delete_photo")])
    case .show(let rowId):
      return .dictionary(["fn": .string("show"), "row_id": .string(rowId)])
    case .expandText(let rowId):
      return .dictionary(["fn": .string("expand_text"), "row_id": .string(rowId)])
    case .highlightRequired(let field):
      return .dictionary(["fn": .string("highlight_required"), "field": .string(field)])
    case .clear(let binding):
      return .dictionary(["fn": .string("clear"), "binding": .string(binding)])
    case .select(let value):
      return .dictionary(["fn": .string("select"), "value": .string(value)])
    case .copyToClipboard(let value):
      return .dictionary(["fn": .string("copy_to_clipboard"), "value": .string(value)])
    case .navigate(let flowId, let pageId, let query):
      var dict: [String: EVYJson] = [
        "fn": .string("navigate"),
        "flow_id": .string(flowId),
        "page_id": .string(pageId),
      ]
      if !query.isEmpty {
        dict["query"] = .dictionary(query.mapValues { .string($0) })
      }
      return .dictionary(dict)
    case .create(let resource, let mode, let id_destination):
      var dict: [String: EVYJson] = [
        "fn": .string("create"),
        "resource": .string(resource),
      ]
      switch mode {
      case .submit:
        dict["mode"] = .string("submit")
      case .inline(let data):
        dict["mode"] = .string("inline")
        dict["data"] = .dictionary(data.mapValues { .string($0) })
      case .fromPath(let data_path):
        dict["mode"] = .string("from_path")
        dict["data_path"] = .string(data_path)
      }
      if let id_destination {
        dict["id_destination"] = .string(id_destination)
      }
      return .dictionary(dict)
    case .update(let resource, let mode, let filter, let changes):
      var dict: [String: EVYJson] = [
        "fn": .string("update"),
        "resource": .string(resource),
        "mode": .string(mode.rawValue),
      ]
      if mode == .store {
        dict["filter"] = .dictionary(filter.mapValues { .string($0) })
      }
      switch changes {
      case .literal(let map):
        dict["changes"] = .dictionary(map.mapValues { .string($0) })
      case .path(let path):
        dict["changes_path"] = .string(path)
      }
      return .dictionary(dict)
    }
  }
}
