//
//  EVYSwipeGeometryTests.swift
//  evyTests
//

import XCTest

@testable import evy

final class EVYSwipeGeometryTests: XCTestCase {
  func testHorizontalDominanceAcceptsWiderHorizontalTranslation() {
    XCTAssertTrue(
      EVYSwipeGeometry.isHorizontalDominant(translation: CGSize(width: -20, height: 5))
    )
    XCTAssertTrue(
      EVYSwipeGeometry.isHorizontalDominant(translation: CGSize(width: 12, height: -4))
    )
  }

  func testHorizontalDominanceRejectsVerticalScroll() {
    XCTAssertFalse(
      EVYSwipeGeometry.isHorizontalDominant(translation: CGSize(width: 4, height: -20))
    )
    XCTAssertFalse(
      EVYSwipeGeometry.isHorizontalDominant(translation: CGSize(width: -5, height: 18))
    )
  }

  func testDragOffsetDoesNotOvershootRightWhenClosed() {
    let offset = EVYSwipeGeometry.dragOffset(
      translation: CGSize(width: 40, height: 0),
      isOpen: false
    )
    XCTAssertEqual(offset, 0)
  }

  func testDragOffsetFollowsLeftwardTranslationWhenClosed() {
    let offset = EVYSwipeGeometry.dragOffset(
      translation: CGSize(width: -30, height: 0),
      isOpen: false
    )
    XCTAssertEqual(offset, -30)
  }

  func testDragOffsetRubberBandsPastRevealWidth() {
    let offset = EVYSwipeGeometry.dragOffset(
      translation: CGSize(width: -100, height: 0),
      isOpen: false
    )
    XCTAssertLessThan(offset, -EVYSwipeGeometry.revealWidth)
    XCTAssertGreaterThan(offset, -100)
  }

  func testDragOffsetFromOpenStartsAtRevealWidth() {
    let offset = EVYSwipeGeometry.dragOffset(
      translation: CGSize(width: 0, height: 0),
      isOpen: true
    )
    XCTAssertEqual(offset, -EVYSwipeGeometry.revealWidth)
  }

  func testEndStateClosedBelowRevealThreshold() {
    let state = EVYSwipeGeometry.endState(
      translation: CGSize(width: -10, height: 0),
      isOpen: false,
      rowWidth: 320
    )
    XCTAssertEqual(state, .closed)
  }

  func testEndStateOpenPastRevealThreshold() {
    let state = EVYSwipeGeometry.endState(
      translation: CGSize(width: -40, height: 0),
      isOpen: false,
      rowWidth: 320
    )
    XCTAssertEqual(state, .open)
  }

  func testEndStateExecutePastFullSwipeThreshold() {
    let state = EVYSwipeGeometry.endState(
      translation: CGSize(width: -200, height: 0),
      isOpen: false,
      rowWidth: 320
    )
    XCTAssertEqual(state, .execute)
  }

  func testEndStateWhileOpenBiasesTowardClosedOnRightwardDrag() {
    let state = EVYSwipeGeometry.endState(
      translation: CGSize(width: 40, height: 0),
      isOpen: true,
      rowWidth: 320
    )
    XCTAssertEqual(state, .closed)
  }

  func testEndStateWhileOpenStaysOpenWhenStillPastThreshold() {
    let state = EVYSwipeGeometry.endState(
      translation: CGSize(width: 10, height: 0),
      isOpen: true,
      rowWidth: 320
    )
    XCTAssertEqual(state, .open)
  }

  func testSwipeIdentityDisambiguatesSharedTemplateRowIds() {
    let rowId = "8d5b9e32-ac4e-5f7b-b2d3-9e8f4a6c0b12"
    let firstId = "c84f227e-69ed-4c69-9f53-aafd7a918c6b"
    let secondId = "d533476c-5099-4c7d-8e9a-42a8f6ca2f6e"
    let firstDatum = EVYJson.dictionary(["id": .string(firstId)])
    let secondDatum = EVYJson.dictionary(["id": .string(secondId)])

    let firstIdentity = EVYSwipeRowIdentity.make(rowId: rowId, datum: firstDatum)
    let secondIdentity = EVYSwipeRowIdentity.make(rowId: rowId, datum: secondDatum)

    XCTAssertEqual(firstIdentity, "\(rowId)_\(firstId)")
    XCTAssertEqual(secondIdentity, "\(rowId)_\(secondId)")
    XCTAssertNotEqual(firstIdentity, secondIdentity)
    XCTAssertEqual(EVYSwipeRowIdentity.make(rowId: rowId, datum: nil), rowId)
  }
}
