//
//  EVYSelectContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

public struct SelectContainerChild: Decodable {
    let title: String
    let child: EVYRow
}

public class SelectContainerContent: SDUI.Content {
    let children: [SelectContainerChild]
    let children_data: String?
    
    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: SDUI.ContainerContentCodingKeys.self)
        self.children = try container.decode([SelectContainerChild].self, forKey: .children)
        self.children_data = try? container.decode(String.self, forKey: .children_data)
        
        try super.init(from: decoder)
    }
}
public struct SelectContainerView: Decodable {
    let content: SelectContainerContent
    let placeholder: SDUI.Placeholder?
}

struct EVYSelectContainerRow: View {
    public static var JSONType = "SelectContainer"
    
    private let view: SelectContainerView
    @State private var selected: String
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SelectContainerView.self, forKey:.view)
        selected = self.view.content.children.first!.title
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
        Spacer()
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json = SDUIConstants.selectContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
