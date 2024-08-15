//
//  EVYInlinePickerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePickerRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let value: String
    }
}
    
struct EVYInlinePickerRow: View {
    public static let JSONType = "InlinePicker"
    
    private let view: EVYInlinePickerRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYInlinePickerRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.minPading)
            }
            EVYInlinePicker(title: view.content.title,
                            value: view.content.value,
                            data: view.data,
                            destination: edit.destination)
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let durations = DataConstants.durations.data(using: .utf8)!
    try! EVY.data.create(key: "durations", data: durations)
    
    let json =  SDUIConstants.distancePickerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
