//
//  EVYInlinePickerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePickerRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let format: String
    }
}
    
struct EVYInlinePickerRow: View, EVYRowProtocol {
    public static let JSONType = "InlinePicker"
    
    private let view: EVYInlinePickerRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYInlinePickerRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}
		
		do {
			let storedValue = try EVY.getDataFromText(edit.destination!)
			return storedValue.toString().count > 0
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
            EVYInlinePicker(title: view.content.title,
                            data: view.data,
                            format: view.content.format,
                            destination: edit.destination!)
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let durations = DataConstants.durations.data(using: .utf8)!
    try! EVY.data.create(key: "durations", data: durations)
    
    let json = SDUIConstants.distancePickerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
