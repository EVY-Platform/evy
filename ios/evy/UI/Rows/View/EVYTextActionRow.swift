//
//  EVYTextActionRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextActionRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let text: String
        let placeholder: String
        let action: String
    }
}

struct EVYTextActionRow: View {
    public static let JSONType = "TextAction"
    
    private let view: EVYTextActionRowView
    private let edit: SDUI.Edit
    
    private var hasAddress = false
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYTextActionRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
        
        let address = EVY.getValueFromText(view.content.text).value
        self.hasAddress = !view.content.text.contains(address)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.minPading)
            }
            HStack {
                if hasAddress {
                    EVYTextView(view.content.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    EVYTextView(view.content.placeholder, style: .info)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                EVYTextView(view.content.action).foregroundColor(.blue)
            }
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json =  SDUIConstants.addressRow.data(using: .utf8)!
    
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
