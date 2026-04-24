//
//  EVYInlinePickerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePickerRow: View, EVYRowProtocol {
	public static let JSONType = "InlinePicker"

	private let view: InlinePickerRowViewData
	private let source: String
	private let destination: String

	init(view: InlinePickerRowViewData, source: String, destination: String) {
		self.view = view
		self.source = source
		self.destination = destination
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			if !destination.isEmpty {
				EVYInlinePicker(
					title: view.content.title,
					data: source,
					format: view.content.format,
					destination: destination
				)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["2", "pages", "2", "rows", "0", "view", "content", "children", "1", "view", "content", "children", "3"])
	}
}
