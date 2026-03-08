//
//  EVYButtonRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYButtonRow: View, EVYRowProtocol {
	@Environment(\.navigate) private var navigate

	public static let JSONType = "Button"

	private let view: ButtonRowViewData
	private let actions: [SDUI_RowAction]

	init(view: ButtonRowViewData, actions: [SDUI_RowAction]) {
		self.view = view
		self.actions = actions
	}

	private func performAction() {
		EVYActionRunner.run(actions: actions, navigate: navigate)
	}

	var body: some View {
		EVYButton(label: view.content.label, action: performAction)
			.frame(maxWidth: .infinity, alignment: .center)
			.padding(.top, Constants.minorPadding)
			.padding(.bottom, Constants.majorPadding)
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "1", "footer"])
	}
}
