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
    
    @State private var usePlaceholder: Bool = true
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYTextActionRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            HStack {
                EVYTextView(usePlaceholder ? view.content.placeholder :
                                view.content.text,
                            style: .info)
                .frame(maxWidth: .infinity, alignment: .leading)
                EVYTextView(view.content.action)
                    .foregroundColor(Constants.actionColor)
            }
        }.onAppear {
            let parsedText = EVY.getValueFromText(view.content.text).value
            // If the parsed text is the same as the raw text, then it means
            // the data is missing and we should be using placeholder
            usePlaceholder = view.content.text.contains(parsedText)
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json =  SDUIConstants.addressRow.data(using: .utf8)!
    
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
