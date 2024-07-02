//
//  EVYInputRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYInputRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let value: String
        let placeholder: String
    }
}
    
struct EVYInputRow: View {
    public static let JSONType = "Input"
    
    private let view: EVYInputRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYInputRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.minorPadding)
            }
            EVYTextField(input: view.content.value,
                         destination: edit.destination,
                         placeholder: view.content.placeholder)
        }
    }
}



#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json =  SDUIConstants.inputWidthRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
