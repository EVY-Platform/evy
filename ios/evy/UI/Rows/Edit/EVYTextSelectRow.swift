//
//  EVYTextSelectRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextSelectRow: View, EVYRowProtocol {
	public static let JSONType = "TextSelect"

	private let view: TextSelectRowViewData
	private let edit: SDUI_RowEdit?
	private let action: SDUI_RowAction?
	private let value: EVYJson
	private let selected: EVYState<Bool>

	init?(view: TextSelectRowViewData, edit: SDUI_RowEdit?, action: SDUI_RowAction?) {
		guard let destination = edit?.destination else { return nil }
		self.view = view
		self.edit = edit
		self.action = action
		self.selected = EVYState(watch: destination, setter: {
			do {
				return try EVY.evaluateFromText($0)
			} catch {
				#if DEBUG
				print("[EVYTextSelectRow] Error evaluating selection: \(error)")
				#endif
				return false
			}
		})
		let temporaryId = UUID().uuidString
		guard (try? EVY.updateValue(view.content.text, at: temporaryId)) != nil,
		      let data = try? EVY.data.get(key: temporaryId),
		      let decoded = try? data.decoded() else { return nil }
		self.value = decoded
	}

	func complete() -> Bool {
		guard let validation = edit?.validation, validation.requiredBool else { return true }
		return selected.value
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
				EVYSelectItem(
					destination: destination,
					value: value,
					format: "",
					selectionStyle: .multi,
					target: .single_bool,
					textStyle: .info
				)
				.frame(maxWidth: .infinity, alignment: .leading)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "3", "rows", "1", "view", "content", "children", "0", "child"])
	}
}
