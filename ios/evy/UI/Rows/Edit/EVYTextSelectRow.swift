//
//  EVYTextSelectRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextSelectRowView: Codable {
    let content: ContentData
    
    struct ContentData: Codable {
        let title: String
        let text: String
    }
}

struct EVYTextSelectRow: View, EVYRowProtocol {
    public static let JSONType = "TextSelect"
    
    private let view: EVYTextSelectRowView
    private let edit: SDUI.Edit
    private let value: EVYJson
    
    private var selected: EVYState<Bool>
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYTextSelectRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
        
        selected = EVYState(watch: edit.destination!, setter: {
            do {
                return try EVY.evaluateFromText($0)
            } catch {}
            
            return false
        })
        
        let temporaryId = UUID().uuidString
        try EVY.updateValue(view.content.text, at: temporaryId)
        value = try EVY.data.get(key: temporaryId).decoded()
    }
	
	init(from decoder: Decoder) throws {
		let container = try decoder.container(keyedBy: RowCodingKeys.self)
		try self.init(container: container)
	}
	
	func encode(to encoder: Encoder) throws {
		var container = encoder.container(keyedBy: RowCodingKeys.self)
		try container.encode(view, forKey: .view)
		try container.encode(edit, forKey: .edit)
	}
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}
		
		do {
			let storedValue = try EVY.getDataFromText(edit.destination!)
			return storedValue.toString() == "true"
		} catch {
			return false
		}
	}
	
	func incompleteMessages() -> [String] {
		edit.validation.message != nil ? [edit.validation.message!] : []
	}
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            EVYSelectItem(destination: edit.destination!,
                          value: value,
                          format: "",
                          selectionStyle: .multi,
                          target: .single_bool,
                          textStyle: .info)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json = SDUIConstants.paymentAppRow.data(using: .utf8)!
    
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
