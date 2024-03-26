//
//  EVYButton.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYButton: View {
    @Environment(\.navigate) private var navigate
    
    let label: String
    let target: Route
    
    var body: some View {
        Button(action: {
            navigate(target)
        }) {
            EVYTextView(label).foregroundColor(.white)
        }
        .padding(EdgeInsets(top: Constants.majorPadding,
                            leading: Constants.majorPadding,
                            bottom: Constants.majorPadding,
                            trailing: Constants.majorPadding))
        .frame(maxWidth: 200)
        .background(Color.blue)
        .cornerRadius(Constants.smallCornerRadius)
    }
}

#Preview {
    return EVYButton(label: "Submit", target: Route(flowId: "test", pageId: "test"))
}
