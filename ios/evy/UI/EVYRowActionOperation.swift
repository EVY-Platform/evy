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
}

enum EVYRowActionOperation {
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

  static func selectPhotoHandler(
    _ apply: @escaping () throws -> Void
  ) -> EVYRowOperationHandler {
    { operation in
      guard case .selectPhoto = operation else { throw unsupportedError }
      try apply()
    }
  }

  static func expandPhotoHandler(
    _ apply: @escaping () throws -> Void
  ) -> EVYRowOperationHandler {
    { operation in
      guard case .expandPhoto = operation else { throw unsupportedError }
      try apply()
    }
  }

  static func deletePhotoHandler(
    _ apply: @escaping () throws -> Void
  ) -> EVYRowOperationHandler {
    { operation in
      guard case .deletePhoto = operation else { throw unsupportedError }
      try apply()
    }
  }
}
