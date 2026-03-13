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
	private let destination: String?

	init(view: SelectPhotoRowViewData, destination: String?) {
		self.view = view
		self.destination = destination
	}

	var body: some View {
		if let destination {
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
		try! await EVY.getRow(["2", "pages", "0", "rows", "0"])
	}
}
