//
//  EVYColumnContainerRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYColumnContainerRow: View, EVYRowProtocol {
	public static let JSONType = "ColumnContainer"

	private let view: ColumnContainerRowViewData

	init(view: ColumnContainerRowViewData) {
		self.view = view
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			HStack(alignment: .top) {
				ForEach(Array(view.content.children.enumerated()), id: \.offset) { _, child in
					EVYRow(row: child)
				}
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "0", "rows", "5"])
	}
}
