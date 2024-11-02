//
//  EVYColumnContainerRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYColumnContainerRow: View, EVYRowProtocol {
    public static let JSONType = "ColumnContainer"
    
    private let view: SDUI.ContainerView
	private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(SDUI.ContainerView.self, forKey:.view)
		edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		let completeChildren = view.content.children.filter {
			$0.child.complete()
		}
		return completeChildren.count >= Int(edit.validation.minAmount ?? 1)
	}
	
	func incompleteMessages() -> [String] {
		return view.content.children
			.filter { $0.child.view.complete() == false }
			.map { $0.child.view.incompleteMessages() }
			.flatMap(\.self)
	}
    
    var body: some View {
        VStack(alignment:.leading) {
			if (view.content.children.first!.title.count > 0) {
				EVYTextView(view.content.children.first!.title)
                    .padding(.vertical, Constants.padding)
            }
            HStack(alignment: .top) {
				ForEach(view.content.children, id: \.child.id) { child in
					child.child
                }
            }
        }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json = SDUIConstants.columnContainerDimensionsRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
