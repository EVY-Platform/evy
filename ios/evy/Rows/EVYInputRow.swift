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
    }
    
    @State private var title: String = ""
    
    var body: some View {
        VStack(spacing: Constants.textLinePadding) {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            EVYTextField(value: $title,
                         label: view.content.value,
                         placeholder: view.content.placeholder)
        }
    }
}



#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    let _ = try! EVYDataFactory.create(item)
    
    let json =  SDUIConstants.inputRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
