//
//  EVYDropdownRow.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

struct EVYDropdownRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let format: String
        let placeholder: String
    }
}
    
struct EVYDropdownRow: View, EVYRowProtocol {
    public static let JSONType = "Dropdown"
    
    private let view: EVYDropdownRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYDropdownRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}

		do {
			let storedValue = try EVY.getDataFromText(edit.destination!)
			let min = edit.validation.minAmount ?? 1
			switch storedValue {
			case .array(let arrayValue):
				return arrayValue.count >= min
			default:
				return storedValue.toString().count >= min
			}
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
            EVYDropdown(title: view.content.title,
                        placeholder: view.content.placeholder,
                        data: view.data,
                        format: view.content.format,
                        destination: edit.destination!)
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let conditions = DataConstants.conditions.data(using: .utf8)!
    try! EVY.data.create(key: "conditions", data: conditions)
    
    let json =  SDUIConstants.condition.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
