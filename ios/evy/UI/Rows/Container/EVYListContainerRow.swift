//
//  EVYListContainerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYListContainerRow: View, EVYRowProtocol {
    public static let JSONType = "ListContainer"
    
    private let view: SDUI.ContainerView
	private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(SDUI.ContainerView.self, forKey:.view)
		edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if edit.validation.minAmount == nil { return true }
		
		let completeChildren = view.content.children.filter {
			$0.child.complete()
		}
		return completeChildren.count >= edit.validation.minAmount!
	}
	
	func incompleteMessages() -> [String] {
		view.content.children
			.filter { $0.child.view.complete() == false }
			.map { $0.child.view.incompleteMessages() }
			.flatMap(\.self)
	}
    
    var body: some View {
        VStack(alignment:.leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			ForEach(view.content.children, id: \.child.id) { child in
				if child.title.count > 0 {
					EVYTextView(child.title)
						.padding(.vertical, Constants.padding)
				}
				child.child
			}
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","2","rows", "0", "views", "content", "children", "0", "child"])
	}
}
