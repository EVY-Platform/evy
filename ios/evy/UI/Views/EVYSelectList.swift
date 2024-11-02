//
//  EVYSelectList.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSelectList: View {
    let options: EVYJsonArray
    let format: String
    let destination: String
    
    var body: some View {
        List {
            ForEach(options, id: \.self) { value in
                EVYSelectItem(destination: destination,
                              value: value,
                              format: format,
                              selectionStyle: .single,
                              target: .single_identifier)
				.frame(height: Constants.listRowHeight)
            }
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
        }
        .listStyle(.inset)
    }
}


#Preview {
    let selling_reasons = DataConstants.selling_reasons.data(using: .utf8)!
    try! EVY.data.create(key: "selling_reasons", data: selling_reasons)
    
    let options = try! EVY.getDataFromText("{selling_reasons}")
    switch options {
    case let .array(arrayValue):
        return EVYSelectList(options: arrayValue,
                             format: "{$0.value}",
                             destination: "{item.selling_reason_id}")
    default:
        return Text("error")
    }
}
