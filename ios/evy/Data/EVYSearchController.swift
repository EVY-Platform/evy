//
//  EVYSearchController.swift
//  evy
//
//  Created by Geoffroy Lesage on 22/8/2024.
//

import Foundation
import SwiftUI

private enum EVYSearchSourceType {
    case api
    case local
}

public struct EVYSearchResult: Equatable {
    let data: EVYJson
    let value: String
    let displayRow: UI_Row

    public static func == (lhs: EVYSearchResult, rhs: EVYSearchResult) -> Bool {
        lhs.value == rhs.value && lhs.data == rhs.data
    }
}

// MARK: - Search Result Template
private func deepCopyJSONValue(_ value: Any) -> Any {
    switch value {
    case let d as [String: Any]:
        var out: [String: Any] = [:]
        out.reserveCapacity(d.count)
        for (k, v) in d {
            out[k] = deepCopyJSONValue(v)
        }
        return out
    case let d as NSDictionary:
        var out: [String: Any] = [:]
        for case let (k as String, v) in d {
            out[k] = deepCopyJSONValue(v)
        }
        return out
    case let a as [Any]:
        return a.map { deepCopyJSONValue($0) }
    case let a as NSArray:
        return a.map { deepCopyJSONValue($0) }
    default:
        return value
    }
}

@MainActor
private final class SearchTemplateFormatPrep {
    private let rootPrototype: [String: Any]
    private static let displayKeys = [
        "title", "subtitle", "text", "label", "placeholder", "value",
    ]

    private static let datumReferenceRegex = try! NSRegularExpression(
        pattern: #"\{\$datum:([A-Za-z0-9_.-]+)\}"#
    )

    private static func datumValue(path: String, datum: EVYJson) -> String {
        let pathSegments = path.split(separator: ".").map(String.init)
        if pathSegments.isEmpty {
            return datum.toString()
        }

        var currentValue = datum
        for pathSegment in pathSegments {
            switch currentValue {
            case let .dictionary(dictionaryValue):
                guard let nextValue = dictionaryValue[pathSegment] else {
                    return ""
                }
                currentValue = nextValue
            case let .array(arrayValue):
                guard let index = Int(pathSegment), arrayValue.indices.contains(index) else {
                    return ""
                }
                currentValue = arrayValue[index]
            default:
                return ""
            }
        }

        return currentValue.toString()
    }

    private static func formatDatumReferences(_ template: String, datum: EVYJson) -> String {
        var formattedTemplate = template
        let templateRange = NSRange(template.startIndex..., in: template)
        let matches = datumReferenceRegex.matches(in: template, range: templateRange)

        for match in matches.reversed() {
            guard let fullRange = Range(match.range, in: formattedTemplate),
                  let pathRange = Range(match.range(at: 1), in: formattedTemplate) else {
                continue
            }

            let path = String(formattedTemplate[pathRange])
            formattedTemplate.replaceSubrange(
                fullRange,
                with: datumValue(path: path, datum: datum)
            )
        }

        return formattedTemplate
    }

    init(template: UI_Row) throws {
        let data = try JSONEncoder().encode(template)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw EVYSearchFormattingError.invalidTemplate
        }
        rootPrototype = root
    }

    func formattedResult(datum: EVYJson) throws -> (row: UI_Row, value: String) {
        guard var root = deepCopyJSONValue(rootPrototype) as? [String: Any],
              var view = root["view"] as? [String: Any],
              var content = view["content"] as? [String: Any] else {
            throw EVYSearchFormattingError.invalidTemplate
        }
        for key in Array(content.keys) {
            if let raw = content[key] as? String {
                content[key] = Self.formatDatumReferences(raw, datum: datum)
            }
        }
        let value = Self.displayKeys
            .compactMap { content[$0] as? String }
            .first(where: { !$0.isEmpty }) ?? ""
        view["content"] = content
        root["view"] = view
        root["id"] = UUID().uuidString
        let out = try JSONSerialization.data(withJSONObject: root)
        return (try JSONDecoder().decode(UI_Row.self, from: out), value)
    }
}

enum EVYSearchFormattingError: Error {
    case invalidTemplate
}

@MainActor
class EVYSearchController: ObservableObject {
    private static let apiSourcePrefix = "$api:"

    private let sourceType: EVYSearchSourceType
    private let resultTemplate: UI_Row?

    private var cachedFormatPrep: SearchTemplateFormatPrep?

    @Published var results: [EVYSearchResult] = []

    init(source: String, resultTemplate: UI_Row?) {
        self.resultTemplate = resultTemplate
        sourceType = Self.searchSourceType(for: source)
    }

    private static func searchSourceType(for source: String) -> EVYSearchSourceType {
        guard let binding = bracedBinding(from: source),
              binding.hasPrefix(apiSourcePrefix) else {
            return .local
        }
        return .api
    }

    private static func bracedBinding(from source: String) -> String? {
        let normalizedSource = source.trimmingCharacters(in: .whitespacesAndNewlines)
        let sourceProps = EVY.parsePropsFromText(normalizedSource)
        guard normalizedSource == "{\(sourceProps)}" else {
            return nil
        }

        return sourceProps
    }

    private func loadFormatPrep() throws -> SearchTemplateFormatPrep {
        if let prep = cachedFormatPrep {
            return prep
        }
        guard let resultTemplate else {
            throw EVYSearchFormattingError.invalidTemplate
        }
        let prep = try SearchTemplateFormatPrep(template: resultTemplate)
        cachedFormatPrep = prep
        return prep
    }

    func makeSearchResult(datum: EVYJson) throws -> EVYSearchResult {
        let (row, value) = try loadFormatPrep().formattedResult(datum: datum)
        return EVYSearchResult(data: datum, value: value, displayRow: row)
    }

    func search(name: String) async {
        guard resultTemplate != nil else {
            results = []
            return
        }

        switch sourceType {
        case .local:
            let address = """
                {
                    "unit": "100",
                    "street": "Main Street",
                    "city": "Rosebery",
                    "postcode": "2018",
                    "state": "NSW",
                    "country": "Australia",
                    "location": {
                        "latitude": "45.323124",
                        "longitude": "-3.424233"
                    },
                    "instructions": ""
                }
            """.data(using: .utf8)!
            let id = UUID()
            do {
                try EVY.data.create(key: id.uuidString, data: address)
                let json = try EVY.getDataFromProps(id.uuidString)
                results = [try makeSearchResult(datum: json)]
            } catch {
                #if DEBUG
                print("[EVYSearchController] Error in local search: \(error)")
                #endif
                results = []
            }
        default:
            do {
                let data = try await EVYMovieAPI().search(term: name)
                let response = try JSONDecoder().decode([EVYJson].self, from: data)
                results = try response.map { try makeSearchResult(datum: $0) }
            } catch {
                #if DEBUG
                print("[EVYSearchController] Error in API search: \(error)")
                #endif
                results = []
            }
        }
    }
}

#Preview {
    AsyncPreview { (asyncView: EVYSearch) in
        asyncView
    } view: {
        // Local-only: no EVY.getRow / EVYAPIManager (avoids API_HOST fatalError in Xcode canvas).
        if !EVY.data.exists(key: "tags") {
            try EVY.data.create(key: "tags", data: Data("[]".utf8))
        }
        let templateJson = """
        {
            "id": "preview-search-row",
            "type": "Info",
            "source": "",
            "destination": "",
            "actions": [],
            "view": {
                "content": {
                    "title": "{$datum:unit} {$datum:street}",
                    "subtitle": "{$datum:city} {$datum:state} {$datum:postcode}",
                    "icon": ""
                }
            }
        }
        """
        let template = try JSONDecoder().decode(
            UI_Row.self,
            from: Data(templateJson.utf8),
        )
        return EVYSearch(
            source: "{$local:address}",
            destination: "{tags}",
            placeholder: "Search",
            resultTemplate: template
        )
    }
}
