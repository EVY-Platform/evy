//
//  EVYDropdownRow.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

public enum EVYDropdownError: Error {
    case invalidOptions
    case invalidOption
}

struct EVYDropdownRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let value: String
        let placeholder: String
    }
}
    
struct EVYDropdownRow: View {
    public static var JSONType = "Dropdown"
    
    private let view: EVYDropdownRowView
    private let edit: SDUI.Edit
    private var options: EVYJsonArray = []
    
    @State private var selection: EVYJson?
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYDropdownRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
        
        if let (_, props) = EVYTextView.propsFromText(view.data),
           let parsedOptions = try EVYDataManager.i.parseProps(props),
           case let .array(arrayValue) = parsedOptions {
            self.options.append(contentsOf: arrayValue)
        }
    }
    
    @State private var showSheet = false
    
    var body: some View {
        VStack {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Constants.minorPadding)
            }
            Button(action: { showSheet.toggle() }) {
                HStack {
                    if let value = selection?.displayValue() {
                        EVYTextView(value).foregroundColor(.black)
                    } else {
                        EVYTextView(view.content.placeholder)
                            .foregroundColor(Constants.placeholderColor)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, Constants.minorPadding)
                    }
                    Spacer()
                    EVYTextView.parsedText("::chevron.down::")
                        .foregroundColor(.black)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                        .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth))
            }
        }
        .sheet(isPresented: $showSheet, content: {
            VStack {
                if (view.content.title.count > 0) {
                    EVYTextView(view.content.title)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 30)
                }
                EVYSelect(selection: $selection, options: options)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                    .onChange(of: selection) { oldValue, newValue in
                        if let key = newValue?.identifierValue() {
                            try! EVYDataManager.i.updateValue(key, at: edit.destination)
                        }
                    }
            }
        })
    }
}


#Preview {
    let json =  SDUIConstants.dropdownRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
