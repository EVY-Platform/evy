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
}
