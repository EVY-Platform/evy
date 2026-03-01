//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum RowCodingKeys: String, CodingKey {
	case type
	case view
	case edit
	case action
}

public enum EVYRowError: Error {
	case cannotParseRow
}

protocol EVYRowProtocol: View {
	static var JSONType: String { get }
	func complete() -> Bool
	func incompleteMessages() -> [String]
}

extension EVYRowProtocol {
	func complete() -> Bool { true }
	func incompleteMessages() -> [String] { [] }
}

extension SDUI_Row {
	static func complete(row: SDUI_Row) -> Bool {
		guard let payload = try? SDUI_RowPayload.from(row: row) else { return true }
		return complete(payload: payload)
	}

	static func incompleteMessages(row: SDUI_Row) -> [String] {
		guard let payload = try? SDUI_RowPayload.from(row: row) else { return [] }
		return incompleteMessages(payload: payload)
	}

	private static func complete(payload: SDUI_RowPayload) -> Bool {
		switch payload {
		case .button(_, _, _): return true
		case .calendar(let v, let e, _): return EVYCalendarRow(view: v, edit: e).complete()
		case .columnContainer(let v, let e, _): return EVYColumnContainerRow(view: v, edit: e).complete()
		case .dropdown(let v, let e, _): return EVYDropdownRow(view: v, edit: e).complete()
		case .info(_, _, _): return true
		case .inlinePicker(_, _, _): return true
		case .inputList(_, _, _): return true
		case .input(let v, let e, _): return EVYInputRow(view: v, edit: e).complete()
		case .listContainer(let v, let e, _): return EVYListContainerRow(view: v, edit: e).complete()
		case .search(let v, let e, _): return EVYSearchRow(view: v, edit: e).complete()
		case .selectPhoto(let v, let e, _): return EVYSelectPhotoRow(view: v, edit: e).complete()
		case .selectSegmentContainer(let v, let e, _): return EVYSelectSegmentContainerRow(view: v, edit: e).complete()
		case .sheetContainer(_, _, _): return true
		case .textAction(_, _, _): return true
		case .textArea(let v, let e, _): return EVYTextAreaRow(view: v, edit: e).complete()
		case .text(_, _, _): return true
		case .textSelect(let v, let e, let a):
			return EVYTextSelectRow(view: v, edit: e, action: a)?.complete() ?? true
		}
	}

	private static func incompleteMessages(payload: SDUI_RowPayload) -> [String] {
		switch payload {
		case .button(_, _, _): return []
		case .calendar(let v, let e, _): return EVYCalendarRow(view: v, edit: e).incompleteMessages()
		case .columnContainer(let v, let e, _): return EVYColumnContainerRow(view: v, edit: e).incompleteMessages()
		case .dropdown(let v, let e, _): return EVYDropdownRow(view: v, edit: e).incompleteMessages()
		case .info(_, _, _): return []
		case .inlinePicker(_, _, _): return []
		case .inputList(_, _, _): return []
		case .input(let v, let e, _): return EVYInputRow(view: v, edit: e).incompleteMessages()
		case .listContainer(let v, let e, _): return EVYListContainerRow(view: v, edit: e).incompleteMessages()
		case .search(let v, let e, _): return EVYSearchRow(view: v, edit: e).incompleteMessages()
		case .selectPhoto(let v, let e, _): return EVYSelectPhotoRow(view: v, edit: e).incompleteMessages()
		case .selectSegmentContainer(let v, let e, _): return EVYSelectSegmentContainerRow(view: v, edit: e).incompleteMessages()
		case .sheetContainer(_, _, _): return []
		case .textAction(_, _, _): return []
		case .textArea(let v, let e, _): return EVYTextAreaRow(view: v, edit: e).incompleteMessages()
		case .text(_, _, _): return []
		case .textSelect(let v, let e, let a):
			if let row = EVYTextSelectRow(view: v, edit: e, action: a) {
				return row.incompleteMessages()
			}
			return []
		}
	}
}

struct EVYRow: View, Identifiable {
	let row: SDUI_Row
	var id: String { row.id }

	var body: some View {
		Group {
			if let payload = try? SDUI_RowPayload.from(row: row) {
				rowView(for: payload)
			}
		}
	}

	@ViewBuilder
	private func rowView(for payload: SDUI_RowPayload) -> some View {
		switch payload {
		case .button(let v, _, let a): EVYButtonRow(view: v, action: a)
		case .calendar(let v, let e, _): EVYCalendarRow(view: v, edit: e)
		case .columnContainer(let v, let e, _): EVYColumnContainerRow(view: v, edit: e)
		case .dropdown(let v, let e, _): EVYDropdownRow(view: v, edit: e)
		case .info(let v, _, _): EVYInfoRow(view: v)
		case .inlinePicker(let v, let e, _): EVYInlinePickerRow(view: v, edit: e)
		case .inputList(let v, let e, _): EVYInputListRow(view: v, edit: e)
		case .input(let v, let e, _): EVYInputRow(view: v, edit: e)
		case .listContainer(let v, let e, _): EVYListContainerRow(view: v, edit: e)
		case .search(let v, let e, _): EVYSearchRow(view: v, edit: e)
		case .selectPhoto(let v, let e, _): EVYSelectPhotoRow(view: v, edit: e)
		case .selectSegmentContainer(let v, let e, _): EVYSelectSegmentContainerRow(view: v, edit: e)
		case .sheetContainer(let v, _, _): EVYSheetContainerRow(view: v)
		case .textAction(let v, _, let a): EVYTextActionRow(view: v, action: a)
		case .textArea(let v, let e, _): EVYTextAreaRow(view: v, edit: e)
		case .text(let v, _, _): EVYTextRow(view: v)
		case .textSelect(let v, let e, let a):
			if let row = EVYTextSelectRow(view: v, edit: e, action: a) {
				row
			} else {
				EmptyView()
			}
		}
	}
}
