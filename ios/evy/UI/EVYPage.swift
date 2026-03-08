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
	}
}
