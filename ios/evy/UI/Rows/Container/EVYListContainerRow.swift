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
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SDUI.ContainerView.self, forKey:.view)
    }
	
	func complete() -> Bool {
		let completeChildren = view.content.children.filter({
			$0.child.complete()
		})
		return completeChildren.count >= Int(view.content.required_children) ?? 0
	}
    
    var body: some View {
        VStack(alignment:.leading) {
			if (view.content.children.first!.title.count > 0) {
				EVYTextView(view.content.children.first!.title)
					.padding(.vertical, Constants.padding)
			}
            VStack(alignment: .leading) {
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
    
    let json = SDUIConstants.pickupContainer.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}

