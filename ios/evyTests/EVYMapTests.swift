//
//  EVYMapTests.swift
//  evyTests
//

import CoreLocation
import XCTest

@testable import evy

@MainActor
final class EVYMapTests: XCTestCase {
  private var originalCurrentUserData: Data?

  override func setUpWithError() throws {
    try super.setUpWithError()
    originalCurrentUserData = try? EVY.publicStore.get(
      namespace: EVYNamespace.local,
      resource: "user",
      id: EVYNamespace.singletonId
    ).data
    try? EVY.publicStore.delete(
      namespace: EVYNamespace.local,
      resource: "user",
      id: EVYNamespace.singletonId
    )
  }

  override func tearDownWithError() throws {
    try? EVY.publicStore.delete(
      namespace: EVYNamespace.local,
      resource: "user",
      id: EVYNamespace.singletonId
    )
    if let originalCurrentUserData {
      try? EVY.publicStore.upsert(
        namespace: EVYNamespace.local,
        resource: "user",
        id: EVYNamespace.singletonId,
        value: originalCurrentUserData
      )
    }
    originalCurrentUserData = nil
    try super.tearDownWithError()
  }

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

  func testParsesFullFlatAddress() {
    let coordinate = EVYJson.dictionary([
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "country": .string("Australia"),
      "latitude": .decimal(-33.9172075),
      "longitude": .decimal(151.1985883),
    ]).locationCoordinate()

    assertCoordinate(coordinate, latitude: -33.9172075, longitude: 151.1985883)
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

  func testMapRowResolvesUserAddressSource() throws {
    try seedCurrentUserAddress(latitude: -33.9172075, longitude: 151.1985883)

    let coordinate = EVYMapRow.resolveLocation(source: "{user.address}").locationCoordinate()

    assertCoordinate(coordinate, latitude: -33.9172075, longitude: 151.1985883)
  }

  func testMapRowLocationStateUpdatesWhenUserAddressArrives() throws {
    let location = EVYState(
      textToWatch: "{user.address}",
      setter: { EVYMapRow.resolveLocation(source: "{user.address}") }
    )

    XCTAssertNil(location.value.locationCoordinate())

    try seedCurrentUserAddress(latitude: -33.8688, longitude: 151.2093)

    assertCoordinate(location.value.locationCoordinate(), latitude: -33.8688, longitude: 151.2093)
  }

  private func seedCurrentUserAddress(latitude: Decimal, longitude: Decimal) throws {
    let user = EVYJson.dictionary([
      "id": .string("test-user"),
      "address": .dictionary([
        "unit": .string(""),
        "street": .string("42 Test Lane"),
        "city": .string("Sydney"),
        "postcode": .string("2000"),
        "state": .string("NSW"),
        "country": .string("Australia"),
        "latitude": .decimal(latitude),
        "longitude": .decimal(longitude),
      ]),
    ])
    let encodedUser = try JSONEncoder().encode(user)
    try EVY.publicStore.upsert(
      namespace: EVYNamespace.local,
      resource: "user",
      id: EVYNamespace.singletonId,
      value: encodedUser
    )
  }
}
