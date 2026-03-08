//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRow: View, EVYRowProtocol {
	public static let JSONType = "Search"

	private let view: SearchRowViewData
	private let edit: SDUI_RowEdit?
	@State private var showSheet = false

	init(view: SearchRowViewData, edit: SDUI_RowEdit?) {
		self.view = view
		self.edit = edit
	}

	func complete() -> Bool {
		guard let validation = edit?.validation, validation.requiredBool else { return true }
		guard let destination = edit?.destination else { return false }
		do {
			let storedValue = try EVY.getDataFromText(destination)
			return storedValue.toString().count > 0
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
				EVYSearch(
					source: view.data ?? "",
					destination: destination,
					placeholder: view.content.placeholder,
					format: view.content.format
				)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "0", "rows", "6", "view", "content", "children", "0", "child"])
	}
}
