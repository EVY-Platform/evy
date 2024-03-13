//
//  EVYButton.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYButton: View {
    let label: String
    let target: String
    
    var body: some View {
        Button(action: {
            NotificationCenter.default.post(name: .navigateEVYPage,
                                            object: nil,
                                            userInfo: ["target": target])
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
    let item = DataConstants.item.data(using: .utf8)!
    EVYParser.instance.create(id: "item", data: item)
    
    return EVYButton(label: "Submit", target: "create_item_step_2")
}
