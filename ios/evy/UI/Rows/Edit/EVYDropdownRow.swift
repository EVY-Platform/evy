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
	private let destination: String?

	init(view: DropdownRowViewData, destination: String?) {
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
				EVYDropdown(
					title: view.content.title,
					placeholder: view.content.placeholder,
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
		try! await EVY.getRow(["1", "pages", "0", "rows", "3"])
	}
}
