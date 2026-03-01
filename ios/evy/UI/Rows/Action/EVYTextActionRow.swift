//
//  EVYTextActionRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextActionRow: View, EVYRowProtocol {
	public static let JSONType = "TextAction"

	private let view: TextActionRowViewData
	private let action: SDUI_RowAction?

	init(view: TextActionRowViewData, action: SDUI_RowAction?) {
		self.view = view
		self.action = action
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			HStack {
				EVYTextView(view.content.text,
				            placeholder: view.content.placeholder,
				            style: .info)
					.frame(maxWidth: .infinity, alignment: .leading)
				EVYTextView(view.content.action, style: .action)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "2", "rows", "0", "view", "content", "children", "0", "child", "view", "content", "children", "1", "child"])
	}
}
