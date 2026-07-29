//
//  EVY+MessageRequests.swift
//  evy
//

import Foundation
import SwiftUI

/// Who may answer a transfer request, and what answering does.
///
/// This is the one piece of domain behaviour the client hard-codes, because none of it is
/// expressible in SDUI today:
///
/// - `visible` is evaluated with no datum (`EVYRow.makeVisibilityState`), so a `Search`
///   child row cannot vary per result - which is what "hide accept on my own request"
///   needs.
/// - a row has a single `swipe-left` affordance, and a recipient needs two.
/// - no expression can read ownership. It lives in `EVYOwnershipLedger` and the private
///   store, not in data the interpreter can reach.
///
/// Closing those three gaps - a datum-aware `visible`, multi-action swipe in the row
/// schema, an ownership predicate in the expression language - is what would let this move
/// back into a flow. Until then it lives here, in one testable place.
///
/// Note what this type never does: write to an existing message. A message is write-once, and
/// a request's whole life is the sequence of messages naming it, ordered by `createdAt` -
/// asked, then accepted, rejected or withdrawn. Accepting, rejecting and cancelling are the
/// same operation with a different `data.value`.
@MainActor
enum EVYMessageRequest {
  /// The transfer kinds a request can ask for. Hard-coded with the rest of this rule.
  static let types = ["pickup", "delivery", "shipping"]

  /// Which side of a request this device is on.
  ///
  /// Not a property of the message - a property of who is holding it. The same row reads
  /// as `sender` on the device that asked and `recipient` on the device that can answer.
  enum Role {
    case sender
    case recipient
  }

  /// A message's state, all of it. A `status` column held part of this and an `archivedAt`
  /// column the rest; both are gone.
  ///
  /// Only `pending` and `accept` mean anything is in flight. `reject` and `cancel` are both
  /// terminal and read the same way by the item page - they differ in who said it, which is
  /// worth keeping distinct even though nothing branches on it yet.
  enum Value: String {
    case pending
    case accept
    case reject
    case cancel
  }

  /// The fields answering a request needs: where it pointed, and what it said.
  struct Request: Equatable {
    let id: String
    let fk: String
    let service: String
    let resource: String
    let type: String
    /// The request's whole `data`, because the response carries it forward. See `respond`.
    let data: [String: EVYJson]
  }

  /// A message-shaped datum that is an open transfer request.
  ///
  /// Identified positively - `data.value` is `pending` - rather than by an absent value, so
  /// a message kind that simply carries no state is never mistaken for one to answer.
  static func classify(_ datum: EVYJson?) -> Request? {
    guard case .dictionary(let message) = datum,
      case .string(let id) = message["id"],
      case .string(let fk) = message["fk"],
      case .string(let service) = message["service"],
      case .string(let resource) = message["resource"],
      case .dictionary(let data) = message["data"],
      case .string(let type) = data["type"],
      types.contains(type),
      case .string(Value.pending.rawValue) = data["value"]
    else {
      return nil
    }
    return Request(
      id: id, fk: fk, service: service, resource: resource, type: type, data: data)
  }

  /// Whether a message answers another one, rather than asking for something.
  ///
  /// Keyed on `message_id` rather than on `value`, so it stays true of a response whatever
  /// decision it carries.
  static func isResponse(_ datum: EVYJson?) -> Bool {
    guard case .dictionary(let message) = datum,
      case .dictionary(let data) = message["data"],
      case .string(let answered) = data["message_id"]
    else {
      return false
    }
    return !answered.isEmpty
  }

  /// Reads the ledger rather than `ownedServiceResources()` for authorship: receiving a
  /// message puts it in the private store, which also confers ownership of it, so the
  /// wider set cannot tell "I wrote this" from "this reached me". Getting that backwards
  /// would read a recipient as the sender and drop the affordance entirely.
  ///
  /// `sender` wins when both hold, which is what stops a device that listed the item from
  /// accepting its own request.
  static func role(for request: Request) -> Role? {
    if EVY.didCreate(
      service: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue,
      id: request.id
    ) {
      return .sender
    }
    let ownsAddressedRecord = EVY.ownedServiceResources().contains {
      $0.service == request.service && $0.resource == request.resource
        && $0.ids.contains(request.fk)
    }
    return ownsAddressedRecord ? .recipient : nil
  }

  /// Whether anything has been said about this request yet - accepted, rejected or withdrawn.
  ///
  /// Keyed on a message naming it, not on the value that message carries, so it covers a
  /// cancellation as readily as an answer.
  static func isSettled(_ request: Request) -> Bool {
    storedMessages().contains { message in
      guard case .dictionary(let data) = message["data"],
        case .string(let answered) = data["message_id"]
      else {
        return false
      }
      return answered == request.id
    }
  }

  /// Answer a request: create the message that says so.
  ///
  /// The decision is a new record - the request is never rewritten to say it was answered.
  /// The response addresses whatever record the request addressed, which is what keeps the
  /// item page able to find it.
  ///
  /// It also **carries the request's `data` forward**, overriding only `value` and adding
  /// `message_id`. That is not redundancy: a lookup that finds the response cannot reach
  /// through it to the request, so anything the answered state displays - the pickup time,
  /// the shipping postcode - has to be on the message that says "accepted", or the
  /// confirmation row renders with nothing in it.
  ///
  /// Nothing is written to the request. What closes it out is simply that this message is
  /// newer: the item page reads the latest message for the item and transfer method, so an
  /// answer supersedes the ask by existing.
  static func respond(to request: Request, with value: Value) throws {
    try append(value, to: request)
  }

  /// Withdraw a request. Mechanically the same as answering one - the sender is saying the
  /// last word about it rather than the recipient - so it goes through the same path.
  static func cancel(_ request: Request) throws {
    try append(.cancel, to: request)
  }

  private static func append(_ value: Value, to request: Request) throws {
    var data = request.data
    data["message_id"] = .string(request.id)
    data["value"] = .string(value.rawValue)

    _ = try EVY.create(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue,
      data: [
        "fk": .string(request.fk),
        "service": .string(request.service),
        "resource": .string(request.resource),
        "data": .dictionary(data),
      ]
    )
  }

  /// What this device may do about a message, if anything.
  ///
  /// Empty for a response, for a request that has already been settled - answered either way,
  /// or withdrawn - and for a request this device is neither side of, which is what keeps the
  /// affordance off a message someone else is dealing with.
  static func swipeActions(for datum: EVYJson?) -> [EVYSwipeAction] {
    guard let request = classify(datum) else { return [] }
    guard let role = role(for: request), !isSettled(request) else { return [] }

    switch role {
    case .recipient:
      return [
        EVYSwipeAction(id: "accept", label: "::check::", tint: Constants.actionColor) {
          perform { try respond(to: request, with: .accept) }
        },
        EVYSwipeAction(id: "reject", label: "::x::", tint: Constants.dangerColor) {
          perform { try respond(to: request, with: .reject) }
        },
      ]
    case .sender:
      return [
        EVYSwipeAction(id: "cancel", label: "::x::", tint: Constants.dangerColor) {
          perform { try cancel(request) }
        }
      ]
    }
  }

  private static func storedMessages() -> [[String: EVYJson]] {
    EVY.syncedStores()
      .flatMap { store in
        (try? store.getAll(
          namespace: EVYNamespace.evy,
          resource: EVYCoreResource.messages.rawValue
        )) ?? []
      }
      .compactMap { row in
        guard case .dictionary(let values) = try? row.decoded() else { return nil }
        return values
      }
  }

  /// A swipe handler cannot throw, and a failed write is worth surfacing rather than
  /// swallowing - the same channel `EVYActionRunner` uses for a failed action.
  private static func perform(_ write: () throws -> Void) {
    do {
      try write()
    } catch {
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
    }
  }
}
