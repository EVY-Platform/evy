//
//  EVYInputListRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 21/8/2024.
//

import SwiftUI

struct EVYInputListRow: View, EVYRowProtocol {
	public static let JSONType = "InputList"

	private let view: InputListRowViewData

	init(view: InputListRowViewData) {
		self.view = view
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			EVYInputList(
				data: view.data ?? "",
				format: view.content.format,
				placeholder: view.content.placeholder
			)
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "0", "rows", "6", "view", "content", "child"])
	}
}
