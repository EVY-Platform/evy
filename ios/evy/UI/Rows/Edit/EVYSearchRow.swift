//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let format: String
        let placeholder: String
    }
}
    
struct EVYSearchRow: View, EVYRowProtocol {
    public static let JSONType = "Search"
    
    private let view: EVYSearchRowView
    private let edit: SDUI.Edit
	
	@State private var showSheet = false
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSearchRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}
		
		do {
			let storedValue = try EVY.getDataFromText(edit.destination)
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
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            EVYSearch(source: view.data,
                      destination: edit.destination,
                      placeholder: view.content.placeholder,
                      format: view.content.format)
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json = SDUIConstants.tagsRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
