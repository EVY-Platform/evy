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


struct EVY {
    static let data = EVYDataManager()
	
	/**
	 * Methods to get SDUI data
	 * TODO: These are really just for debugging/deving so some tweaking needs to happen
	 */
	static func getSDUIFlows() async throws -> [EVYFlow] {
		try await EVYAPIManager.shared.fetch(method: "getFlows",
											 params: "",
											 expecting: [EVYFlow].self)
	}
	
	static func createItem() async throws {
		let itemData = try await EVYAPIManager.shared.fetch(method: "getData",
															params: "",
															expecting: EVYJson.self)
		let item = try JSONEncoder().encode(itemData.parseProp(props: ["item"]))
		try! EVY.data.create(key: "item", data: item)
	}
	
	static func syncData() async throws {
		let data = try await EVYAPIManager.shared.fetch(method: "getData",
														params: "",
														expecting: EVYJson.self)
		
		let sellingReasons = try JSONEncoder().encode(data.parseProp(props: ["selling_reasons"]))
		try! EVY.data.create(key: "selling_reasons", data: sellingReasons)
		let conditions = try JSONEncoder().encode(data.parseProp(props: ["conditions"]))
		try! EVY.data.create(key: "conditions", data: conditions)
		let durations = try JSONEncoder().encode(data.parseProp(props: ["durations"]))
		try! EVY.data.create(key: "durations", data: durations)
		let areas = try JSONEncoder().encode(data.parseProp(props: ["areas"]))
		try! EVY.data.create(key: "areas", data: areas)
	}
	
	static func getRow(_ props: [String]) async throws -> EVYRow {
		try await syncData()
		try await createItem()
		
		let flowData = try await EVYAPIManager.shared.fetch(method: "getFlows",
															params: "",
															expecting: EVYJson.self)
		let row = try JSONEncoder().encode(flowData.parseProp(props: props))
		return try JSONDecoder().decode(EVYRow.self, from: row)
	}
    
    /**
     * Methods to get data from various sources and inputs
     */
    static func getDataFromText(_ input: String) throws -> EVYJson {
        let props = EVYInterpreter.parsePropsFromText(input)
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        let data = try data.get(key: splitProps.first!)
        return data.decoded().parseProp(props: Array(splitProps[1...]))
    }
    
    static func getDataFromProps(_ props: String) throws -> EVYJson {
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        let data = try data.get(key: splitProps.first!)
        return data.decoded().parseProp(props: Array(splitProps[1...]))
    }
    
    static func getValueFromText(_ input: String, editing: Bool = false) -> EVYValue {
        do {
            let match = try EVYInterpreter.parseTextFromText(input, editing)
            return EVYValue(match.value, match.prefix, match.suffix)
        } catch {}
        
        return EVYValue(input, nil, nil)
    }
    
    static func parsePropsFromText(_ input: String) -> String {
        EVYInterpreter.parsePropsFromText(input)
    }
    
    static func evaluateFromText(_ input: String) throws -> Bool {
        let match = try EVYInterpreter.parseTextFromText(input)
        return match.value == "true"
    }
    
    static func formatData(json: EVYJson, format: String) -> String {
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
        
        do {
            let encodedData = try JSONEncoder().encode(json)
            try data.create(key: temporaryId, data: encodedData)
            let returnText = getValueFromText(formatWithNewData)
            try data.delete(key: temporaryId)
            return returnText.toString()
        } catch {
            return json.toString()
        }
    }
    
    /**
     * Submitting a new entity to the API
     */
    static func submit(key: String) throws {
        let existing = try data.get(key: key)
        existing.key = UUID().uuidString
        // TODO: Send to API
    }
    
    /**
     * Updating a nested value in an object by using props
     */
    static func updateValue(_ value: String, at: String) throws {
        try updateData("\"\(value)\"".data(using: .utf8)!, at: at)
    }
    
    static func updateData(_ newData: Data, at: String) throws {
        let props = EVYInterpreter.parsePropsFromText(at)
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        let firstProp = splitProps.first!
        
        if data.exists(key: firstProp) {
            let dataObj = try data.get(key: firstProp)
            try dataObj.updateDataWithData(newData, props: Array(splitProps[1...]))
			try data.update(props: splitProps, data: dataObj.data)
        } else {
            try data.create(key: firstProp, data: newData)
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
				.foregroundStyle(Color.red)
		} else {
			Text("Building view...")
		}
	}
}
