//
//  EVYPage.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import UIKit

extension UI_Page: View {
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
		.simultaneousGesture(TapGesture().onEnded {
			UIApplication.shared.sendAction(
				#selector(UIResponder.resignFirstResponder),
				to: nil,
				from: nil,
				for: nil
			)
		})
	}

	@MainActor private func bootstrapDrafts() {
		for row in rows {
			Self.bootstrapDrafts(for: row)
		}
		if let footer = footer {
			Self.bootstrapDrafts(for: footer)
		}
	}

	@MainActor
	private static func bootstrapDrafts(for row: UI_Row) {
		if let destination = row.destination, !destination.isEmpty {
			let variableName = EVYInterpreter.parsePropsFromText(destination)
			if !variableName.isEmpty {
				let initialData: Data?
				if row.type == .inlinePicker {
					initialData = "[]".data(using: .utf8)
				} else if row.type == .calendar {
					initialData = try? EVY.data.get(key: "timeslots").data
				} else {
					initialData = nil
				}
				EVY.ensureDraftExists(variableName: variableName, initialData: initialData)
			}
		}
		if let children = row.view.content.children {
			for child in children {
				bootstrapDrafts(for: child)
			}
		}
		if let child = row.view.content.child {
			bootstrapDrafts(for: child)
		}
	}
}
