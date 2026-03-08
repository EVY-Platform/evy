//
//  EVYPage.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

extension SDUI_Page: View {
	public var body: some View {
		Group {
			ScrollView {
				ForEach(rows, id: \.id) { row in
					EVYRow(row: row)
						.padding(.horizontal, Constants.majorPadding)
						.padding(.vertical, Constants.minorPadding)
				}
			}
			.navigationTitle(title)
			.accessibilityIdentifier("page_\(id)")
			if let footer = footer {
				EVYRow(row: footer)
					.overlay(alignment: .top, content: {
						Rectangle()
							.fill(Constants.borderColor)
							.frame(height: 1)
							.padding(.top, -Constants.minorPadding)
					})
					.accessibilityIdentifier("pageFooter_\(id)")
			}
		}
		.onAppear {
			bootstrapDrafts()
		}
	}

	@MainActor private func bootstrapDrafts() {
		var destinations: Set<String> = []
		for row in rows {
			Self.collectDestinations(from: row, into: &destinations)
		}
		if let footer = footer {
			Self.collectDestinations(from: footer, into: &destinations)
		}
		for destination in destinations {
			let variableName = EVYInterpreter.parsePropsFromText(destination)
			if !variableName.isEmpty {
				EVY.ensureDraftExists(variableName: variableName)
			}
		}
	}

	private static func collectDestinations(from row: SDUI_Row, into destinations: inout Set<String>) {
		if let destination = row.destination, !destination.isEmpty {
			destinations.insert(destination)
		}
		if let children = row.view.content.children {
			for child in children {
				collectDestinations(from: child, into: &destinations)
			}
		}
		if let child = row.view.content.child {
			collectDestinations(from: child, into: &destinations)
		}
	}
}
