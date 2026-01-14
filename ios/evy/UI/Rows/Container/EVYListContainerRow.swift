//
//  EVYListContainerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

private class ListContainerContent: Codable {
	let title: String
	let children: [EVYRow]
}
private struct ListContainerView: Codable {
	let content: ListContainerContent
}

struct EVYListContainerRow: View, EVYRowProtocol {
    public static let JSONType = "ListContainer"
    
    private let view: ListContainerView
	private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(ListContainerView.self, forKey:.view)
		edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if edit.validation.minAmount == nil { return true }
		
		let completeChildren = view.content.children.filter {
			$0.complete()
		}
		return completeChildren.count >= edit.validation.minAmount!
	}
	
	func incompleteMessages() -> [String] {
		view.content.children
			.filter { $0.complete() == false }
			.map { $0.incompleteMessages() }
			.flatMap(\.self)
	}
    
    var body: some View {
        VStack(alignment:.leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			ForEach(Array(view.content.children.enumerated()), id: \.offset) { index, child in
				child
			}
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","2","rows", "0", "view", "content", "children", "0"])
	}
}
