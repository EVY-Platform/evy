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
    let target: SDUI.ActionTarget
    @Binding var disabled: Bool
    
    var body: some View {
        Button(action: {
            switch target {
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
        .background(disabled ? Color.gray : Color.blue)
        .cornerRadius(Constants.smallCornerRadius)
        .disabled(disabled)
    }
}

#Preview {
    let json =  SDUIConstants.navigate3ButtonRow.data(using: .utf8)!
    let button = try? JSONDecoder().decode(EVYRow.self, from: json)
    
    return button
}
