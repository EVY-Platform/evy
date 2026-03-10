//
//  EVYListContainerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYListContainerRow: View, EVYRowProtocol {
	public static let JSONType = "ListContainer"

	private let view: ListContainerRowViewData

	init(view: ListContainerRowViewData) {
		self.view = view
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			ForEach(view.content.children, id: \.id) { child in
				EVYRow(row: child)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "2", "rows", "0", "view", "content", "children", "0"])
	}
}
