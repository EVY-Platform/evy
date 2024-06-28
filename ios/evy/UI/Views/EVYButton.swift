//
//  EVYButton.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYButton: View {
    let label: String
    let action: () -> Void
    
    @Binding var disabled: Bool
    
    var body: some View {
        Button(action: action) {
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
