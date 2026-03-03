//
//  EVYSelectPhotoRow.swift
//  evy
//
//  Created by Clemence Chalot on 18/02/2024.
//

import SwiftUI
import PhotosUI

struct EVYSelectPhotoRow: View, EVYRowProtocol {
	public static let JSONType = "SelectPhoto"

	private let view: SelectPhotoRowViewData
	private let edit: SDUI_RowEdit?

	init(view: SelectPhotoRowViewData, edit: SDUI_RowEdit?) {
		self.view = view
		self.edit = edit
	}

	func complete() -> Bool {
		guard let validation = edit?.validation, validation.requiredBool else { return true }
		guard let minAmount = validation.minAmountInt else { return true }
		return view.content.photos.count >= minAmount
	}

	func incompleteMessages() -> [String] {
		guard let msg = edit?.validation?.message else { return [] }
		return [msg]
	}

	var body: some View {
		if let destination = edit?.destination {
			EVYSelectPhoto(
				title: view.content.title,
				subtitle: view.content.subtitle,
				icon: view.content.icon,
				content: view.content.content,
				data: view.content.photos,
				destination: destination
			)
		} else {
			Text("Failed to load photo selector")
				.foregroundColor(.red)
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "0", "rows", "0"])
	}
}
