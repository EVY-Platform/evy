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
	@State private var selected: Int = 0
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(SDUI.ContainerView.self, forKey:.view)
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
			}
			Picker("", selection: $selected) {
				ForEach(Array(view.content.children.enumerated()), id: \.offset) { index, child in
					EVYTextView(child.view.content.title).tag(index)
				}
			}
			.pickerStyle(.segmented)
			.padding(.bottom, Constants.majorPadding)
			
			view.content.children[selected]
		}
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","2","rows", "0"])
	}
}
