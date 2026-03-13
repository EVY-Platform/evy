//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRow: View, EVYRowProtocol {
	public static let JSONType = "Search"

	private let view: SearchRowViewData
	private let destination: String?
	@State private var showSheet = false

	init(view: SearchRowViewData, destination: String?) {
		self.view = view
		self.destination = destination
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			if let destination {
				EVYSearch(
					source: view.data ?? "",
					destination: destination,
					placeholder: view.content.placeholder,
					format: view.content.format
				)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["2", "pages", "0", "rows", "6", "view", "content", "children", "0"])
	}
}
