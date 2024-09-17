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
    let format: String
    let placeholder: String?
    
    private var options: EVYJsonArray = []
    
    @State private var selection: EVYJson?
    @State private var showSheet = false
    
    init(title: String?,
         placeholder: String?,
         data: String,
         format: String,
         destination: String)
    {
        self.title = title
        self.destination = destination
        self.format = format
        self.placeholder = placeholder
        
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
                if selection != nil {
                    EVYTextView(EVY.formatData(json: selection!, format: format))
                        .foregroundColor(.black)
                } else {
                    EVYTextView(placeholder ?? "").foregroundColor(Constants.textColor)
                }
            }
            Spacer()
            EVYTextView("::chevron.down::").foregroundColor(.black)
        }
        .padding(EdgeInsets(top: Constants.fieldPadding,
                            leading: Constants.minorPadding,
                            bottom: Constants.fieldPadding,
                            trailing: Constants.minorPadding))
        .background(
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth)
                .opacity(Constants.borderOpacity)
        )
        .contentShape(Rectangle())
        .onTapGesture { showSheet.toggle() }
        .sheet(isPresented: $showSheet, content: {
            VStack {
                if self.title?.count ?? 0 > 0 {
                    EVYTextView(title!).padding(.top, Constants.majorPadding)
                }
                EVYSelect(selection: $selection, options: options, format: format)
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
                       format: "{$0.id}",
                       destination: "{item.condition_id}")
}
