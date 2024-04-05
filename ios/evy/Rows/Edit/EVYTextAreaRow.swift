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
    private let edit: SDUI.Edit
    
    @State private var value: String
    @FocusState private var isFocused: Bool
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYTextAreaRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
        
        _value = State(initialValue: EVYTextView.parseText(self.view.content.value))
    }

    var body: some View {
        VStack {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .font(.evy)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Constants.minorPadding)
            }
            TextField(view.content.placeholder, text: $value, axis: .vertical)
                .lineLimit(10...)
                .focused($isFocused)
                .font(.evy)
                .padding()
                .overlay(
                    RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                        .stroke(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
                )
                .onChange(of: value) { oldValue, newValue in
                    if oldValue != self.view.content.value {
                        try! EVYDataManager.i.updateValue(newValue, at: edit.destination)
                    }
                }
                .onAppear(perform: {
                    value = EVYTextView.parseText(self.view.content.value)
                })
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
    let item = DataConstants.item.data(using: .utf8)!
    try! EVYDataManager.i.create(key: "item", data: item)
    
    let json =  SDUIConstants.textAreaRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
