//
//  EVYSelectRow.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

public enum EVYSelectError: Error {
    case invalidOptions
}

struct EVYSelect: View {
    @Binding var selection: EVYJson?
    let options: EVYJsonArray
    
    var body: some View {
        VStack {
            List(selection: $selection) {
                ForEach(options, id: \.self) { value in
                    HStack {
                        EVYTextView(value.displayValue())
                        Spacer()
                        EVYRadioButton(isSelected: value == selection)
                    }
                }
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
            }
        }
        .environment(\.defaultMinListRowHeight, 70)
        .listStyle(.inset)
    }
}


#Preview {
    let selling_reasons = DataConstants.selling_reasons.data(using: .utf8)!
    try! EVY.data.create(key: "selling_reasons", data: selling_reasons)
    
    let options = EVYValue("selling_reasons").data?.decoded()
    switch options {
    case .array(let arrayValue):
        @State var selection = arrayValue.first
        return EVYSelect(selection: $selection, options: arrayValue)
    default:
        return Text("error")
    }
}
