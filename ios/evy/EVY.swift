//
//  EVY.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/6/2024.
//

import Foundation
import SwiftUI

public enum EVYParamError: Error {
    case invalidProps
}

extension String {
    var isNumber: Bool {
        let digitsCharacters = CharacterSet(charactersIn: "0123456789")
        return CharacterSet(charactersIn: self).isSubset(of: digitsCharacters)
    }
}

struct GetParams: Encodable {
	let namespace: String
	let resource: String
	let filter: Filter?
}

struct Filter: Encodable {
	let id: String?
}

@MainActor
struct EVY {
    static let data = EVYDataManager()
	
	static func getUserData() throws {
		let userData = try EVYJson.from(localJSON: "user_data")
		let encodedUserData = try JSONEncoder().encode(userData)
		do {
			try EVY.data.create(key: "user", data: encodedUserData)
		} catch EVYDataError.keyAlreadyExists {
			// User data already loaded, skip
		}
	}
	
	private static func fetchResource(_ resource: String, namespace: String = "marketplace") async throws -> [EVYJson] {
		try await EVYAPIManager.shared.fetch(
			method: "get",
			params: GetParams(namespace: namespace, resource: resource, filter: nil),
			expecting: [EVYJson].self
		)
	}

	private static func storeIfNew(key: String, from serviceData: EVYJson) {
		do {
			let encoded = try JSONEncoder().encode(serviceData.parseProp(props: [key]))
			try data.create(key: key, data: encoded)
		} catch EVYDataError.keyAlreadyExists {
			// Data already loaded, skip
		} catch {}
	}

	static func getData() async throws -> Data {
		let resources = ["selling_reasons", "conditions", "durations", "areas", "timeslots"]
		var serviceDict: [String: EVYJson] = [:]
		for resource in resources {
			serviceDict[resource] = .array(try await fetchResource(resource))
		}

		let itemsJson = try await fetchResource("items", namespace: "marketplace")
		serviceDict["item"] = itemsJson.first ?? .dictionary([:])

		let serviceData: EVYJson = .dictionary(serviceDict)

		for resource in resources {
			storeIfNew(key: resource, from: serviceData)
		}

		return try JSONEncoder().encode(serviceData.parseProp(props: ["item"]))
	}
	
	static func getSDUI() async throws -> [UI_Flow] {
		try await EVYAPIManager.shared.fetch(method: "get", params: GetParams(namespace: "evy", resource: "sdui", filter: nil), expecting: [UI_Flow].self)
	}
	
	static func createItem() async throws {
		try EVY.data.create(key: "item", data: try await getData())
	}
	
	static func getRow(_ props: [String]) async throws -> UI_Row {
		try await createItem()
		let flowData = try await EVYAPIManager.shared.fetch(method: "get", params: GetParams(namespace: "evy", resource: "sdui", filter: nil), expecting: EVYJson.self)
		let rowData = try JSONEncoder().encode(flowData.parseProp(props: props))
		return try JSONDecoder().decode(UI_Row.self, from: rowData)
	}
    
    /**
     * Methods to get data from various sources and inputs
     */
    static func getDataFromText(_ input: String) throws -> EVYJson {
        let props = EVYInterpreter.parsePropsFromText(input)
        return try getDataFromProps(props)
    }
    
    static func getDataFromProps(_ props: String) throws -> EVYJson {
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        let firstProp = splitProps.first!
        let remainingProps = Array(splitProps[1...])

        if let draftObj = try? data.getDraft(variableName: firstProp) {
            return try draftObj.decoded().parseProp(props: remainingProps)
        }

        let dataObj = try data.get(key: firstProp)
        return try dataObj.decoded().parseProp(props: remainingProps)
    }
    
    static func getValueFromText(_ input: String, editing: Bool = false) throws -> EVYValue {
        let match = try EVYInterpreter.parseTextFromText(input, editing)
        return EVYValue(match.value, match.prefix, match.suffix)
    }
    
    static func parsePropsFromText(_ input: String) -> String {
        EVYInterpreter.parsePropsFromText(input)
    }

    /// Root data key to observe for `.evyDataUpdated` when `text` contains `{count(foo)}`, `{formatCurrency(item.price)}`, etc.
    /// Matches first `{…}` segment; unwraps function calls to their argument path so notifications for `foo` refresh the view.
    static func watchTarget(for text: String) -> String {
        let unwrapped = EVY.parsePropsFromText(text)
        let candidates: [String] = unwrapped == text ? [text] : [unwrapped, text]
        for candidate in candidates {
            if let functionCall = EVYInterpreter.parseFunctionCall(candidate) {
                let parts = EVYInterpreter.splitFunctionArguments(functionCall.functionArgs)
                if let first = parts.first, !first.isEmpty {
                    return EVYInterpreter.stripOptionalSurroundingQuotes(first)
                }
                return functionCall.functionArgs
            }
        }
        if unwrapped != text {
            return unwrapped
        }
        return text
    }

    static func evaluateFromText(_ input: String) throws -> Bool {
        let match = try EVYInterpreter.parseTextFromText(input)
        return match.value == "true"
    }
    
    static func formatData(json: EVYJson, format: String) throws -> String {
        if format.count < 1 {
            return json.toString()
        }
        
        let temporaryId = UUID().uuidString
        let formatWithNewData = format
            .replacingOccurrences(of: "$0.", with: "\(temporaryId).")
            .replacingOccurrences(of: ".$0", with: ".\(temporaryId)")
            .replacingOccurrences(of: "($0)", with: "(\(temporaryId))")
        
        if formatWithNewData.isEmpty {
            return json.toString()
        }
        
        let encodedData = try JSONEncoder().encode(json)
        try data.create(key: temporaryId, data: encodedData)
        let returnText = try getValueFromText(formatWithNewData)
        try data.delete(key: temporaryId)
        return returnText.toString()
    }
    
    static func ensureDraftExists(variableName: String, initialData: Data? = nil) {
        guard !data.exists(key: variableName),
              !data.hasDraft(variableName: variableName) else {
            return
        }
        let emptyData = initialData ?? "\"\"".data(using: .utf8)!
        do {
            try data.createDraft(variableName: variableName, data: emptyData)
        } catch {
            // Draft may have been created concurrently
        }
    }

    /**
     * Creating a new entity in the API
     */
    static func create(key: String) throws {
        let existing = try data.get(key: key)
        existing.key = UUID().uuidString
        // TODO: Send to API
    }
    
    static func updateValue(_ value: String, at: String) throws {
        let destinationProps = EVYInterpreter.parsePropsFromText(at)
        if let (functionName, functionArgs) = EVYInterpreter.parseFunctionCall(destinationProps) {
            switch functionName {
            case "buildCurrency":
                try updateData(try evyBuildCurrency(functionArgs, value), at: functionArgs)
                return
            case "buildAddress":
                try updateData(try evyBuildAddress(functionArgs, value), at: functionArgs)
                return
            default:
                break
            }
        }
        try updateData("\"\(value)\"".data(using: .utf8)!, at: at)
    }
    
    static func updateData(_ newData: Data, at: String) throws {
        let variableName = EVYInterpreter.parsePropsFromText(at)
        let splitProps = try EVYInterpreter.splitPropsFromText(variableName)
        let rootVariable = splitProps.first!
        let remainingProps = Array(splitProps.dropFirst())

        if let existing = try? data.getDraft(variableName: rootVariable) {
            if remainingProps.isEmpty {
                existing.data = newData
            } else {
                try existing.updateDataWithData(newData, props: remainingProps)
            }
            NotificationCenter.default.post(name: .evyDataUpdated, object: rootVariable)
        } else if data.exists(key: rootVariable) {
            let dataObj = try data.get(key: rootVariable)
            if remainingProps.isEmpty {
                dataObj.data = newData
            } else {
                try dataObj.updateDataWithData(newData, props: remainingProps)
            }
            try data.update(props: splitProps, data: dataObj.data)
        } else {
            try data.createDraft(variableName: variableName, data: newData)
        }
    }
}

struct AsyncPreview<VisualContent: View, ViewData>: View {
	var viewBuilder: (ViewData) -> VisualContent
	var view: () async throws -> ViewData?
	
	@State private var viewData: ViewData?
	@State private var error: Error?
	
	var body: some View {
		safeView.task {
			do {
				self.viewData = try await view()
			} catch {
				self.error = error
			}
		}
	}
	
	@ViewBuilder
	private var safeView: some View {
		if let viewData {
			viewBuilder(viewData)
		} else if let error {
			Text(error.localizedDescription)
		} else {
			Text("Building view...")
		}
	}
}
