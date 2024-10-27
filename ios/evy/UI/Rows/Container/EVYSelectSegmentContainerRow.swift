//
//  EVYSelectSegmentContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

struct EVYSelectSegmentContainerRow: View, EVYRowProtocol {
    public static let JSONType = "SelectSegmentContainer"
    
	private let view: SDUI.ContainerView
	private let edit: SDUI.Edit
    @State private var selected: String
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SDUI.ContainerView.self, forKey:.view)
		self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
        selected = self.view.content.children.first!.title
    }
	
	func complete() -> Bool {
		let completeChildren = view.content.children.filter({
			$0.child.complete()
		})
		return completeChildren.count >= Int(edit.validation.minAmount ?? 1)
	}
	
	func incompleteMessages() -> [String] {
		return view.content.children
			.filter({ $0.child.view.complete() == false })
			.map({ $0.child.view.incompleteMessages() })
			.flatMap(\.self)
	}

    var body: some View {
        Picker("", selection: $selected) {
            ForEach(view.content.children, id: \.child.id) { child in
                EVYTextView(child.title).tag(child.title)
            }
        }
        .pickerStyle(.segmented)
        .padding(.bottom, Constants.majorPadding)
        
		view.content.children.first(where: {$0.title == selected})?.child
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json = SDUIConstants.selectSegmentContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
