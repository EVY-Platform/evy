//
//  EVYRowTitle.swift
//  evy
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
