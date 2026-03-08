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
	private let edit: SDUI_RowEdit?

	init(view: TextAreaRowViewData, edit: SDUI_RowEdit?) {
		self.view = view
		self.edit = edit
	}

	func complete() -> Bool {
		guard let validation = edit?.validation, validation.requiredBool else { return true }
		if let minVal = validation.minValueInt {
			return (Int(view.content.value) ?? 0) >= minVal
		}
		if let minChars = validation.minCharactersInt {
			return view.content.value.count >= minChars
		}
		return true
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
		try! await EVY.getRow(["1", "pages", "1", "rows", "0"])
	}
}
