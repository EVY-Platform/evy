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
            if case .array(_) = data {
                self.values = data.displayValues()
            } else {
                self.values.append(data.displayValue())
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
    
    return EVYInputList(input: "{item.tags}",
                        placeholder: "Add tags to improve search")
}
