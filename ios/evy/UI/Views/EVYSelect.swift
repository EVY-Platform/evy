//
//  EVYSelectRow.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSelect: View {
    @Binding var selection: EVYJson?
    let options: EVYJsonArray
    let format: String
    
    var body: some View {
        VStack {
            List(selection: $selection) {
                ForEach(options, id: \.self) { value in
                    HStack {
                        EVYTextView(EVY.formatData(json: value, format: format))
                        Spacer()
                        EVYRadioButton(isSelected: value == selection, style: .single)
                    }
                    .frame(height: 48)
                }
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.inset)
    }
}


#Preview {
    let selling_reasons = DataConstants.selling_reasons.data(using: .utf8)!
    try! EVY.data.create(key: "selling_reasons", data: selling_reasons)
    
    let options = try! EVY.getDataFromText("{selling_reasons}")
    switch options {
    case .array(let arrayValue):
        @State var selection = arrayValue.first
        return EVYSelect(selection: $selection, options: arrayValue, format: "{$0.value}")
    default:
        return Text("error")
    }
}
