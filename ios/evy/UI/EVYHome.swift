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
					navigate(NavOperation.navigate(Route(flowId: "74a49d4b-2176-4925-857a-e29e2991f1bd", pageId: "82cae120-c7b1-4c29-bd42-e1521320b109")))
				}
				.font(.evyTitle)
				.buttonStyle(.plain)
				Button("Create Item") {
					navigate(NavOperation.navigate(Route(flowId: "ca47e6c5-da19-4491-8422-adb40d9e8a27", pageId: "306ed62c-c2af-4652-a873-26c7a388972d")))
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
