//
//  GrammarConformanceTests.swift
//  evyTests
//

import XCTest

@testable import evy

/// Shared grammar conformance corpus. See types/grammar/README.md - the web
/// runner (web/app/utils/grammarConformance.test.ts) executes the same file.
/// Changing parser behaviour means changing a vector in the same commit.
@MainActor
final class GrammarConformanceTests: XCTestCase {

  private struct Vector: Decodable {
    let id: String
    let category: String
    let platforms: [String]
    let input: String
    let data: [String: EVYJson]?
    let expect: [String: EVYJson]
    let notes: String?
  }

  private struct Corpus: Decodable {
    let vectors: [Vector]
  }

  private var seededKeys: [String] = []

  override func setUpWithError() throws {
    try super.setUpWithError()
    installHermeticMutationSync()
  }

  override func tearDownWithError() throws {
    resetHermeticMutationSync()
    for key in seededKeys {
      try? EVY.publicStore.deleteAll(namespace: EVYNamespace.local, resource: key)
    }
    seededKeys = []
    try super.tearDownWithError()
  }

  // MARK: - Corpus loading

  private static func corpusURL() -> URL {
    // evyTests -> ios -> repo root
    URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .appendingPathComponent("types/grammar/conformance.json")
  }

  private func loadVectors() throws -> [Vector] {
    let url = Self.corpusURL()
    let raw = try Data(contentsOf: url)
    return try JSONDecoder().decode(Corpus.self, from: raw).vectors
  }

  private func iosVectors(category: String) throws -> [Vector] {
    try loadVectors().filter {
      $0.platforms.contains("ios") && $0.category == category
    }
  }

  /// Vectors share root names, so seeding replaces any previous value.
  private func seed(_ data: [String: EVYJson]?) throws {
    guard let data else { return }
    for (key, value) in data {
      try? EVY.publicStore.deleteAll(namespace: EVYNamespace.local, resource: key)
      let encoded = try JSONEncoder().encode(value)
      try EVY.publicStore.create(
        namespace: EVYNamespace.local,
        resource: key,
        id: EVYNamespace.singletonId,
        value: encoded
      )
      seededKeys.append(key)
    }
  }

  private func clearSeeded() {
    for key in seededKeys {
      try? EVY.publicStore.deleteAll(namespace: EVYNamespace.local, resource: key)
    }
    seededKeys = []
  }

  private func strings(_ json: EVYJson?) -> [String]? {
    guard case .array(let items) = json else { return nil }
    return items.compactMap {
      if case .string(let value) = $0 { return value }
      return nil
    }
  }

  // MARK: - Corpus integrity

  func testVectorIdsAreUnique() throws {
    let ids = try loadVectors().map(\.id)
    XCTAssertEqual(Set(ids).count, ids.count, "duplicate vector id in corpus")
  }

  func testEveryIosVectorIsCoveredByThisRunner() throws {
    let handled = ["split-args", "comparison", "expression", "display"]
    let uncovered = try loadVectors()
      .filter { $0.platforms.contains("ios") && !handled.contains($0.category) }
      .map(\.id)
    XCTAssertTrue(uncovered.isEmpty, "iOS vectors with no runner: \(uncovered)")
  }

  // MARK: - Categories

  func testSplitArgsVectors() throws {
    for vector in try iosVectors(category: "split-args") {
      let expected = strings(vector.expect["args"]) ?? []
      let actual = EVY.splitFunctionArguments(vector.input)
      XCTAssertEqual(actual, expected, "vector \(vector.id)")
    }
  }

  func testComparisonVectors() throws {
    for vector in try iosVectors(category: "comparison") {
      try seed(vector.data)
      defer { clearSeeded() }

      if case .bool(true) = vector.expect["error"] ?? .null {
        XCTAssertThrowsError(
          try EVY.evaluateFromText(vector.input), "vector \(vector.id) should throw")
        continue
      }

      guard case .bool(let expected) = vector.expect["value"] ?? .null else {
        return XCTFail("vector \(vector.id) has no boolean expectation")
      }
      let actual = try EVY.evaluateFromText(vector.input)
      XCTAssertEqual(actual, expected, "vector \(vector.id): \(vector.notes ?? "")")
    }
  }

  func testExpressionVectors() throws {
    for vector in try iosVectors(category: "expression") {
      try seed(vector.data)
      defer { clearSeeded() }

      if case .bool(true) = vector.expect["error"] ?? .null {
        XCTAssertThrowsError(
          try EVY.getValueFromText(vector.input), "vector \(vector.id) should throw")
        continue
      }

      guard case .string(let expected) = vector.expect["text"] ?? .null else {
        return XCTFail("vector \(vector.id) has no text expectation")
      }
      let actual = try EVY.getValueFromText(vector.input).toString()
      XCTAssertEqual(actual, expected, "vector \(vector.id): \(vector.notes ?? "")")
    }
  }

  /// The rendered-row layer, which swallows resolution errors into empty text.
  func testDisplayVectors() throws {
    for vector in try iosVectors(category: "display") {
      try seed(vector.data)
      defer { clearSeeded() }

      guard case .string(let expected) = vector.expect["text"] ?? .null else {
        return XCTFail("vector \(vector.id) has no text expectation")
      }
      let actual = EVY.displayText(fromSource: vector.input, destination: nil)
      XCTAssertEqual(actual, expected, "vector \(vector.id): \(vector.notes ?? "")")
    }
  }
}
