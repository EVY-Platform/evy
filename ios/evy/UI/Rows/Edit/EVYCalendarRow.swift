//
//  EVYCalendarRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 11/8/2024.
//

import SwiftUI

struct EVYCalendarRow: View, EVYRowProtocol {
	public static let JSONType = "Calendar"

	private let view: CalendarRowViewData
	private let edit: SDUI_RowEdit?

	init(view: CalendarRowViewData, edit: SDUI_RowEdit?) {
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
			case let .array(timeslots):
				let selectedTimeslots = timeslots.filter {
					$0.parseProp(props: ["selected"]).toString() == "true"
				}
				return selectedTimeslots.count >= minAmount
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
		if view.content.title.count > 0 {
			EVYTextView(view.content.title)
				.padding(.vertical, Constants.padding)
		}
		EVYCalendar(primary: view.content.primary, secondary: view.content.secondary)
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "2", "rows", "0", "view", "content", "children", "0", "view", "content", "children", "4"])
	}
}
