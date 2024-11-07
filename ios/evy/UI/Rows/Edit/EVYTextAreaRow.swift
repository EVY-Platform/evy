//
//  EVYTextAreaRow.swift
//  evy
//
//  Created by Clemence Chalot on 26/03/2024.
//

import SwiftUI

struct EVYTextAreaRowView: Codable {
    let content: ContentData
    
    struct ContentData: Codable {
        let title: String
        let value: String
        let placeholder: String
    }
}
    
struct EVYTextAreaRow: View, EVYRowProtocol {
    public static let JSONType = "TextArea"
    
    private let view: EVYTextAreaRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYTextAreaRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}
		
		if edit.validation.minValue != nil {
			return Int(view.content.value) ?? 0 >= edit.validation.minValue!
		}
		return view.content.value.count >= edit.validation.minCharacters ?? 1
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
                         placeholder: view.content.placeholder,
                         multiLine: true)
        }
    }
}

#Preview {
    let json = SDUIConstants.textAreaRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
