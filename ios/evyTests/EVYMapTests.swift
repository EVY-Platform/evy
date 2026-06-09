//
//  EVYMapTests.swift
//  evyTests
//

import CoreLocation
import XCTest

@testable import evy

@MainActor
final class EVYMapTests: XCTestCase {
  private func assertCoordinate(
    _ coordinate: CLLocationCoordinate2D?,
    latitude: Double,
    longitude: Double,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    guard let coordinate else {
      XCTFail("Expected coordinate", file: file, line: line)
      return
    }
    XCTAssertEqual(coordinate.latitude, latitude, accuracy: 0.0001, file: file, line: line)
    XCTAssertEqual(coordinate.longitude, longitude, accuracy: 0.0001, file: file, line: line)
  }

  func testParsesLatitudeLongitudeObject() {
    let coordinate = EVYJson.dictionary([
      "latitude": .decimal(-33.8688), "longitude": .decimal(151.2093),
    ]).locationCoordinate()

    assertCoordinate(coordinate, latitude: -33.8688, longitude: 151.2093)
  }

  func testRejectsLatLngObject() {
    let coordinate = EVYJson.dictionary([
      "lat": .decimal(-33.8688), "lng": .decimal(151.2093),
    ]).locationCoordinate()

    XCTAssertNil(coordinate)
  }

  func testRejectsNestedCoordinateObject() {
    let coordinate = EVYJson.dictionary([
      "coordinate": .dictionary(["latitude": .decimal(-33.8688), "longitude": .decimal(151.2093)])
    ]).locationCoordinate()

    XCTAssertNil(coordinate)
  }

  func testRejectsFallbackCoordinateString() {
    let coordinate = EVYJson.string(" -33.8688 , 151.2093 ").locationCoordinate()

    XCTAssertNil(coordinate)
  }

  func testRejectsMissingCoordinateKeys() {
    let coordinate = EVYJson.dictionary(["latitude": .decimal(-33.8688)]).locationCoordinate()

    XCTAssertNil(coordinate)
  }

  func testRejectsOutOfRangeCoordinates() {
    let coordinate = EVYJson.dictionary([
      "latitude": .decimal(-91), "longitude": .decimal(151.2093),
    ]).locationCoordinate()

    XCTAssertNil(coordinate)
  }

  func testRejectsInvalidCoordinateString() {
    let coordinate = EVYJson.string("not-a-coordinate").locationCoordinate()

    XCTAssertNil(coordinate)
  }
}
