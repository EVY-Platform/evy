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
	private let destination: String?

	init(view: InlinePickerRowViewData, destination: String?) {
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
				EVYInlinePicker(
					title: view.content.title,
					data: view.data ?? "",
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
		try! await EVY.getRow(["1", "pages", "2", "rows", "0", "view", "content", "children", "1", "view", "content", "children", "3"])
	}
}
