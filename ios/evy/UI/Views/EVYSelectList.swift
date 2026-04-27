//
//  EVYSelectList.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSelectList: View {
    let options: [EVYJson]
    let format: String
    let destination: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            ForEach(Array(options.enumerated()), id: \.offset) { _, value in
                EVYSelectItem(destination: destination,
                              value: value,
                              format: format,
                              selectionStyle: .single,
                              target: .single_identifier,
                              onSelect: { dismiss() })
				.frame(height: Constants.listRowHeight)
            }
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! EVY.getUserData()
		try! await EVY.createItem()

		return Group {
			let options = try! EVY.getDataFromText("{selling_reasons}")
			switch options {
			case let .array(arrayValue):
				EVYSelectList(options: arrayValue,
							  format: "{$datum:value}",
							  destination: "{selling_reason}")
			default:
				Text("error")
			}
		}
	}
}
