//
//  EVYInputRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYInputRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let value: String
        let placeholder: String
    }
}
    
struct EVYInputRow: View, EVYRowProtocol {
    public static let JSONType = "Input"
    
    private let view: EVYInputRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYInputRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}
		
		do {
			let storedValue = try EVY.getDataFromText(edit.destination!)
			if edit.validation.minValue != nil {
				return Int(storedValue.toString()) ?? 0 >= edit.validation.minValue!
			}
			return storedValue.toString().count >= edit.validation.minCharacters ?? 1
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
            EVYTextField(input: view.content.value,
                         destination: edit.destination!,
                         placeholder: view.content.placeholder)
        }
    }
}



#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json =  SDUIConstants.inputWidthRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
