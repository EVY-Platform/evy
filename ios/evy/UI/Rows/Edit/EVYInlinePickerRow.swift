//
//  EVYInlinePickerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePickerRowView: Codable {
    let content: ContentData
    let data: String
    
    struct ContentData: Codable {
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
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","2","rows", "0", "view", "content", "children", "1", "child", "view", "content", "children", "3", "child"])
	}
}
