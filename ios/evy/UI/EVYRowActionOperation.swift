//
//  EVYRowActionOperation.swift
//  evy
//

import Foundation

typealias EVYRowOperationHandler = (EVYRowActionOperation) throws -> Void
typealias EVYRowTapCallback<Value> = (Value, @escaping EVYRowOperationHandler) -> Void

enum EVYRowActionTrigger {
  case tap
  case delete
  case tapRow
  case tapColumn
  case swipeLeft
  case submit

  func actions(in rowActions: UI_RowActions) -> [UI_RowAction] {
    switch self {
    case .tap:
      return rowActions.tap
    case .delete:
      return rowActions.delete
    case .tapRow:
      return rowActions.tapRow
    case .tapColumn:
      return rowActions.tapColumn
    case .swipeLeft:
      return rowActions.swipeLeft
    case .submit:
      return rowActions.submit
    }
  }

  static func allActionLists(in rowActions: UI_RowActions) -> [UI_RowAction] {
    [
      rowActions.tap,
      rowActions.delete,
      rowActions.tapRow,
      rowActions.tapColumn,
      rowActions.swipeLeft,
      rowActions.submit,
    ].flatMap { $0 }
  }
}

enum EVYRowActionOperation: Equatable {
  case select(EVYJson)
  case selectPhoto
  case expandPhoto
  case deletePhoto

  static var unsupportedError: EVYError {
    EVYError.invalidData(context: "row does not support this action")
  }

  static func selectHandler(
    _ apply: @escaping (EVYJson) throws -> Void
  ) -> EVYRowOperationHandler {
    { operation in
      guard case .select(let value) = operation else { throw unsupportedError }
      try apply(value)
    }
  }

  static func handler(
    for expected: EVYRowActionOperation,
    _ apply: @escaping () throws -> Void
  ) -> EVYRowOperationHandler {
    { operation in
      guard operation == expected else { throw unsupportedError }
      try apply()
    }
  }
}
