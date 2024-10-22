//
//  EVYSelectSegmentContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

public struct SelectSegmentContainerChild: Decodable {
    let title: String
    let child: EVYRow
}

public class SelectSegmentContainerContent: SDUI.Content {
    let children: [SelectSegmentContainerChild]
    let children_data: String?
    
    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: SDUI.ContainerContentCodingKeys.self)
        self.children = try container.decode([SelectSegmentContainerChild].self, forKey: .children)
        self.children_data = try? container.decode(String.self, forKey: .children_data)
        
        try super.init(from: decoder)
    }
}
public struct SelectSegmentContainerView: Decodable {
    let content: SelectSegmentContainerContent
}

struct EVYSelectSegmentContainerRow: View, EVYRowProtocol {
    public static let JSONType = "SelectSegmentContainer"
    
    private let view: SelectSegmentContainerView
    @State private var selected: String
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SelectSegmentContainerView.self, forKey:.view)
        selected = self.view.content.children.first!.title
    }
	
	func complete() -> Bool {
		view.content.children.contains(where: ({ $0.child.complete() }))
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
