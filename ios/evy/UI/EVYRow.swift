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
	case destination
	case actions
}

public enum EVYRowError: Error {
	case cannotParseRow
}

protocol EVYRowProtocol: View {
	static var JSONType: String { get }
}

struct EVYRow: View, Identifiable {
	let row: UI_Row
	var id: String { row.id }

	var body: some View {
		Group {
			if let payload = try? UI_RowPayload.from(row: row) {
				rowView(for: payload)
			}
		}
	}

	@ViewBuilder
	private func rowView(for payload: UI_RowPayload) -> some View {
		switch payload {
		case .button(let v, _, _, let a): EVYButtonRow(view: v, actions: a)
		case .calendar(let v, _, _, _): EVYCalendarRow(view: v)
		case .columnContainer(let v, _, _, _): EVYColumnContainerRow(view: v)
		case .dropdown(let v, let s, let d, _): EVYDropdownRow(view: v, source: s, destination: d)
		case .info(let v, _, _, _): EVYInfoRow(view: v)
		case .inlinePicker(let v, let s, let d, _): EVYInlinePickerRow(view: v, source: s, destination: d)
		case .inputList(let v, let s, _, _): EVYInputListRow(view: v, source: s)
		case .input(let v, _, let d, _): EVYInputRow(view: v, destination: d)
		case .listContainer(let v, _, _, _): EVYListContainerRow(view: v)
		case .search(let v, let s, let d, _): EVYSearchRow(view: v, source: s, destination: d)
		case .selectPhoto(let v, _, let d, _): EVYSelectPhotoRow(view: v, destination: d)
		case .selectSegmentContainer(let v, _, _, _): EVYSelectSegmentContainerRow(view: v)
		case .sheetContainer(let v, _, _, _): EVYSheetContainerRow(view: v)
		case .textAction(let v, _, _, let a): EVYTextActionRow(view: v, actions: a)
		case .textArea(let v, _, let d, _): EVYTextAreaRow(view: v, destination: d)
		case .text(let v, _, _, _): EVYTextRow(view: v)
		case .textSelect(let v, _, let d, let a):
			if let row = EVYTextSelectRow(view: v, destination: d, actions: a) {
				row
			} else {
				EmptyView()
			}
		}
	}
}
