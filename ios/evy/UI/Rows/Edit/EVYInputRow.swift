//
//  EVYInputRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYInputRow: View, EVYRowProtocol {
	public static let JSONType = "Input"

	private let view: InputRowViewData
	private let destination: String?

	init(view: InputRowViewData, destination: String?) {
		self.view = view
		self.destination = destination
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			if let destination {
				EVYTextField(
					input: view.content.value,
					destination: destination,
					placeholder: view.content.placeholder
				)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["2", "pages", "0", "rows", "1"])
	}
}
