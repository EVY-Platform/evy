//
//  EVYContainerRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYContainerRowView: Codable {
	let content: ContentData
	
	struct ContentData: Codable {
		let title: String
		let child: EVYRow
	}
}

struct EVYContainerRow: View, EVYRowProtocol {
    public static let JSONType = "Container"
    
    public let view: EVYContainerRowView
	private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYContainerRowView.self, forKey:.view)
		edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}
		
		return view.content.child.complete()
	}
	
	func incompleteMessages() -> [String] {
		view.content.child.view.incompleteMessages()
	}
    
    var body: some View {
        VStack(alignment:.leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			view.content.child
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","0","rows", "5", "view", "content", "children", "0"])
	}
}
