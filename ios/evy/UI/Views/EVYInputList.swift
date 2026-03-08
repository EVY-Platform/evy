//
//  EVYInputList.swift
//  evy
//
//  Created by Geoffroy Lesage on 21/8/2024.
//

import SwiftUI

struct EVYInputList: View {
    let data: String
    let format: String
    var placeholder: String
    private var values: EVYState<[String]>
    
    init(data: String, format: String, placeholder: String) {
        self.data = data
        self.format = format
        self.placeholder = placeholder
        
        values = EVYState(watch: data, setter: {
            do {
                let data = try EVY.getDataFromText($0)
                if case let .array(arrayValue) = data {
                    return try arrayValue.map { try EVY.formatData(json: $0, format: format) }
                } else {
                    return [try EVY.formatData(json: data, format: format)]
                }
            } catch {
                #if DEBUG
                print("[EVYInputList] Error formatting data: \(error)")
                #endif
            }
            
            return []
        })
    }
    
    var body: some View {
        EVYTextField(input: "",
                     destination: "",
                     placeholder: values.value.isEmpty ? placeholder : "")
            .disabled(true)
            .overlay {
                ScrollView(.horizontal, content: {
                    HStack(spacing: Constants.majorPadding) {
                        ForEach(values.value, id: \.self) { value in
                            EVYRectangle.fitWidth(content: EVYTextView(value),
                                                  style: .primary)
                        }
                    }
                    .padding(Constants.majorPadding)
                })
                .scrollIndicators(.hidden)
            }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.createItem()
		
		return Group {
			EVYInputList(data: "{tags}",
						 format: "{$0.value}",
						 placeholder: "Add tags to improve search")
		}
	}
}
