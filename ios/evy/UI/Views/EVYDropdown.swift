//
//  EVYDropdown.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI
    
struct EVYDropdown: View {
    let title: String?
    let destination: String
    let placeholder: String?
    
    private var options: EVYJsonArray = []
    
    @State private var selection: EVYJson?
    @State private var showSheet = false
    
    init(title: String?, placeholder: String?, data: String, destination: String) {
        self.title = title
        self.placeholder = placeholder
        self.destination = destination
        
        do {
            let data = try EVY.getDataFromText(data)
            if case let .array(arrayValue) = data {
                self.options.append(contentsOf: arrayValue)
            }
           } catch {}
    }
    
    var body: some View {
        HStack {
            Button(action: { showSheet.toggle() }) {
                if let value = selection?.displayValue() {
                    EVYTextView(value).foregroundColor(.black)
                } else {
                    EVYTextView(placeholder ?? "")
                        .foregroundColor(Constants.placeholderColor)
                }
            }
            Spacer()
            EVYTextView("::chevron.down::")
                .foregroundColor(.black)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
        )
        .contentShape(Rectangle())
        .onTapGesture { showSheet.toggle() }
        .sheet(isPresented: $showSheet, content: {
            VStack {
                if self.title?.count ?? 0 > 0 {
                    EVYTextView(title!).padding(.top, 30)
                }
                EVYSelect(selection: $selection, options: options)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                    .onChange(of: selection) { oldValue, newValue in
                        if let key = newValue?.identifierValue() {
                            try! EVY.updateValue(key, at: destination)
                        }
                    }
            }
        })
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let conditions = DataConstants.conditions.data(using: .utf8)!
    try! EVY.data.create(key: "conditions", data: conditions)
    
    return EVYDropdown(title: "Dropdown",
                       placeholder: "A placeholder",
                       data: "{conditions}",
                       destination: "{item.condition_id}")
}
