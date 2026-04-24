//
//  EVYTextAreaRow.swift
//  evy
//
//  Created by Clemence Chalot on 26/03/2024.
//

import SwiftUI

struct EVYTextAreaRow: View, EVYRowProtocol {
	public static let JSONType = "TextArea"

	private let view: TextAreaRowViewData
	private let destination: String

	init(view: TextAreaRowViewData, destination: String) {
		self.view = view
		self.destination = destination
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			if !destination.isEmpty {
				EVYTextField(
					input: view.content.value,
					destination: destination,
					placeholder: view.content.placeholder,
					multiLine: true
				)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["2", "pages", "1", "rows", "0"])
	}
}
