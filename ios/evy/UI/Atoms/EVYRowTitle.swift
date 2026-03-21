//
//  EVYRowTitle.swift
//  evy
//
//  Shared optional title line for SDUI rows (reduces copy-paste across row views).
//

import SwiftUI

struct EVYRowTitle: View {
	let title: String

	var body: some View {
		Group {
			if !title.isEmpty {
				EVYTextView(title)
					.padding(.vertical, Constants.padding)
			}
		}
	}
}
