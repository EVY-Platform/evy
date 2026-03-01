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
	private let edit: SDUI_RowEdit?

	init(view: DropdownRowViewData, edit: SDUI_RowEdit?) {
		self.view = view
		self.edit = edit
	}

	func complete() -> Bool {
		guard let validation = edit?.validation, validation.requiredBool else { return true }
		guard let minAmount = validation.minAmountInt else { return true }
		guard let destination = edit?.destination else { return false }
		do {
			let storedValue = try EVY.getDataFromText(destination)
			switch storedValue {
			case let .array(arrayValue):
				return arrayValue.count >= minAmount
			default:
				return storedValue.toString().count >= minAmount
			}
		} catch {
			return false
		}
	}

	func incompleteMessages() -> [String] {
		guard let msg = edit?.validation?.message else { return [] }
		return [msg]
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			if let destination = edit?.destination {
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
