//
//  EVYHome.swift
//  evy
//
//  Created by Geoffroy Lesage on 26/3/2024.
//

import SwiftUI

struct EVYHome: View {
    @Environment(\.navigate) private var navigate
	@Binding var loading: Bool
    
    var body: some View {
		if loading {
			ProgressView().controlSize(.large)
		} else {
			VStack(spacing: 40) {
				Button("View Item") {
					navigate(NavOperation.navigate(Route(flowId: "view_item", pageId: "view")))
				}
				.font(.evyTitle)
				.buttonStyle(.plain)
				Button("Create Item") {
					navigate(NavOperation.navigate(Route(flowId: "create_item", pageId: "step_1")))
				}
				.font(.evyTitle)
				.buttonStyle(.plain)
			}
		}
    }
}

#Preview {
	@Previewable @State var loading: Bool = true
	EVYHome(loading: $loading).onAppear {
		Task { @MainActor in
			try await Task.sleep(for: .seconds(1))
			loading = false
		}
	}
}
