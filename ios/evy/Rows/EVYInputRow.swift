//
//  EVYTextRow.swift
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
    public static var JSONType = "Input"
    
    private let view: EVYInputRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYInputRowView.self, forKey:.view)
        _title = State(initialValue: parseEVYText(self.view.content.value))
    }
    
    @State private var title: String = ""
    
    var body: some View {
        VStack {
            if (view.content.title.count > 0) {
                EVYText(view.content.title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, Constants.textLinePadding)
            }
            EVYTextField(value: $title,
                         label: view.content.title,
                         placeholder: view.content.placeholder)
        }
    }
}



#Preview {
    let data = EVYData.shared
    let item = DataConstants.item.data(using: .utf8)!
    try! data.set(name: "item", data: item)
    let json =  SDUIConstants.inputRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
