//
//  EVYTextSelectRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextSelectRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let text: String
    }
}

struct EVYTextSelectRow: View {
    public static let JSONType = "TextSelect"
    
    private let view: EVYTextSelectRowView
    private let edit: SDUI.Edit
    
    @State private var selected = false
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYTextSelectRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
        
        let isSelected = EVY.getValueFromText(edit.destination).value == "true"
        _selected = State(initialValue: isSelected)
    }
    
    var body: some View {
        HStack {
            VStack(alignment:.leading) {
                if view.content.title.count > 0 {
                    EVYTextView(view.content.title)
                        .padding(.vertical, Constants.minPading)
                }
                EVYTextView(view.content.text, style: .info)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            EVYRadioButton(isSelected: selected, style: .multi)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            selected.toggle()
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json =  SDUIConstants.paymentAppRow.data(using: .utf8)!
    
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
