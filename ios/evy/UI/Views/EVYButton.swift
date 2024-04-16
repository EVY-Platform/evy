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
    let action: SDUI.Action
    
    var body: some View {
        Button(action: {
            switch action {
            case .navigate(let route):
                navigate(NavOperation.navigate(route))
            case .submit:
                navigate(NavOperation.submit)
            case .close:
                navigate(NavOperation.close)
            }
        }) {
            EVYTextView(label)
                .frame(maxWidth: .infinity)
                .foregroundColor(.white)
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
