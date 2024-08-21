//
//  EVYInputList.swift
//  evy
//
//  Created by Geoffroy Lesage on 21/8/2024.
//

import SwiftUI

struct EVYInputList: View {
    let placeholder: String
    private var values: [String] = []
    
    init(input: String, placeholder: String) {
        self.placeholder = placeholder
        
        do {
            let data = try EVY.getDataFromText(input)
            if case let .array(arrayValue) = data {
                self.values.append(contentsOf: arrayValue.map({ $0.displayValue() }))
            } else if case let .dictionary(dictionaryValue) = data {
                self.values.append(data.displayValue())
            } else if case let .string(stringValue) = data {
                self.values.append(stringValue)
            }
        } catch {}
    }
    
    var body: some View {
        if (values.isEmpty) {
            EVYTextField(input: "", destination: "", placeholder: placeholder)
        } else {
            EVYTextField(input: "", destination: "", placeholder: "")
                .overlay {
                    ScrollView(.horizontal, content: {
                        HStack(spacing: Constants.majorPadding) {
                            ForEach(values, id: \.self) { value in
                                EVYRectangle(value: value, style: .primary, width: .fit)
                            }
                        }
                        .padding(Constants.majorPadding)
                    })
                    .scrollBounceBehavior(.basedOnSize, axes: [.horizontal])
                    .scrollIndicators(.hidden)
                }
        }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
        
    let tags = DataConstants.tags.data(using: .utf8)!
    try! EVY.data.create(key: "tags", data: tags)
    
    return EVYInputList(input: "{item.tag_ids}",
                        placeholder: "Add tags to improve search")
}
