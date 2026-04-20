//
//  EVYDropdownRow.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

struct EVYDropdownRow: View, EVYRowProtocol {
	public static let JSONType = "Dropdown"

	private let view: DropdownRowViewData
	private let source: String
	private let destination: String?

	init(view: DropdownRowViewData, source: String, destination: String?) {
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
			if let destination {
				EVYDropdown(
					title: view.content.title,
					placeholder: view.content.placeholder,
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
		try! await EVY.getRow(["2", "pages", "0", "rows", "3"])
	}
}
