//
//  EVYActionParser.swift
//  evy
//

import Foundation

struct EVYCreateAction: Equatable {
  let namespace: String
  let resource: String
}

@MainActor
enum EVYActionParser {
  static func createAction(from rawBranch: String) -> EVYCreateAction? {
    guard let parsed = functionCall(from: rawBranch), parsed.name == "create" else {
      return nil
    }
    let args = splitFunctionArguments(parsed.args)
    guard args.count >= 2 else { return nil }
    let namespace = args[0].trimmingCharacters(in: .whitespacesAndNewlines)
    let resource = args[1].trimmingCharacters(in: .whitespacesAndNewlines)
    guard !namespace.isEmpty, !resource.isEmpty else { return nil }
    return EVYCreateAction(namespace: namespace, resource: resource)
  }

  static func functionCall(from rawBranch: String) -> (name: String, args: String)? {
    var branch = rawBranch.trimmingCharacters(in: .whitespacesAndNewlines)
    if branch.hasPrefix("{"), branch.hasSuffix("}") {
      branch = String(branch.dropFirst().dropLast())
    }
    guard let (name, args) = parseFunctionCall(branch) else { return nil }
    return (name, args)
  }
}
