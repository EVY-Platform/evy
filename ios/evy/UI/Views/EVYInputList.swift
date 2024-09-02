//
//  EVYInputList.swift
//  evy
//
//  Created by Geoffroy Lesage on 21/8/2024.
//

import SwiftUI

struct EVYInputList: View {
    let input: String
    var placeholder: String
    @ObservedObject private var values: EVYState<[String]>
    
    init(input: String, placeholder: String) {
        self.input = input
        self.placeholder = placeholder
        
        self.values = EVYState(watch: input, setter: parseInputToValues)
    }
    
    var body: some View {
        if (values.value.isEmpty) {
            EVYTextField(input: "", destination: "", placeholder: placeholder)
                .disabled(true)
        } else {
            EVYTextField(input: "", destination: "", placeholder: "")
                .disabled(true)
                .overlay {
                    ScrollView(.horizontal, content: {
                        HStack(spacing: Constants.majorPadding) {
                            ForEach(values.value, id: \.self) { value in
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

private func parseInputToValues(input: String) -> [String] {
    do {
        let data = try EVY.getDataFromText(input)
        if case .array(_) = data {
            return data.displayValues()
        } else {
            return [data.displayValue()]
        }
    } catch {}
    
    return []
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    return EVYInputList(input: "{item.tags}",
                        placeholder: "Add tags to improve search")
}
