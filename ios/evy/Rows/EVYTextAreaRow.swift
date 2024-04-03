//
//  EVYTextAreaRow.swift
//  evy
//
//  Created by Clemence Chalot on 26/03/2024.
//

import SwiftUI

struct EVYTextAreaRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let value: String
        let placeholder: String
    }
}
    
struct EVYTextAreaRow: View {
    public static var JSONType = "TextArea"
    
    private let view: EVYTextAreaRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYTextAreaRowView.self, forKey:.view)
    }
    
    @State private var note = ""
    @FocusState private var isFocused: Bool
    
    var body: some View {
        VStack {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .font(.evy)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Constants.minorPadding)
            }
            TextField("Write a short description of your product", text: $note, axis: .vertical)
                .lineLimit(10...)
                .focused($isFocused)
                .font(.evy)
                .padding()
                .overlay(
                    RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                        .stroke(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
                )
        }
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        isFocused = false
                }
            }
        }
    }
}

#Preview {
    let json =  SDUIConstants.textAreaRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}