//
//  EVYDropdownRow.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

struct EVYDropdownRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let format: String
        let placeholder: String
    }
}
    
struct EVYDropdownRow: View {
    public static let JSONType = "Dropdown"
    
    private let view: EVYDropdownRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYDropdownRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            EVYDropdown(title: view.content.title,
                        placeholder: view.content.placeholder,
                        data: view.data,
                        format: view.content.format,
                        destination: edit.destination)
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let conditions = DataConstants.conditions.data(using: .utf8)!
    try! EVY.data.create(key: "conditions", data: conditions)
    
    let json =  SDUIConstants.condition.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
