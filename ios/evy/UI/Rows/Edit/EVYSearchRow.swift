//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRowView: Codable {
    let content: ContentData
    let data: String
    
    struct ContentData: Codable {
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
        view = try container.decode(EVYSearchRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
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
            EVYSearch(source: view.data,
                      destination: edit.destination!,
                      placeholder: view.content.placeholder,
                      format: view.content.format)
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","0","rows", "6", "view", "content", "children", "0", "child"])
	}
}
