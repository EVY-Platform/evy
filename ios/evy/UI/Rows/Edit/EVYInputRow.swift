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
	private let edit: SDUI_RowEdit?

	init(view: InputRowViewData, edit: SDUI_RowEdit?) {
		self.view = view
		self.edit = edit
	}

	func complete() -> Bool {
		guard let validation = edit?.validation, validation.requiredBool else {
			return true
		}
		guard let destination = edit?.destination else { return false }
		do {
			let storedValue = try EVY.getDataFromText(destination)
			if let minVal = validation.minValueInt {
				return (Int(storedValue.toString()) ?? 0) >= minVal
			}
			if let minChars = validation.minCharactersInt {
				return storedValue.toString().count >= minChars
			}
			return true
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
		try! await EVY.getRow(["1", "pages", "0", "rows", "1"])
	}
}
