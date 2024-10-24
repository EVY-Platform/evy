//
//  EVYTextAreaRow.swift
//  evy
//
//  Created by Clemence Chalot on 26/03/2024.
//

import SwiftUI

struct EVYTextAreaRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
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
        self.view = try container.decode(EVYTextAreaRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.required {
			return true
		}
		
		return view.content.value.count > 0
	}

    var body: some View {
        VStack(alignment:.leading) {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            EVYTextField(input: view.content.value,
                         destination: edit.destination,
                         placeholder: view.content.placeholder,
                         multiLine: true)
        }
    }
}

#Preview {
    let json =  SDUIConstants.textAreaRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
