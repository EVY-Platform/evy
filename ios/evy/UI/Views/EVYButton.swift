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
    
    @State var disabled: Bool
    
    init(label: String, condition: String?, action: @escaping () -> Void) {
        self.label = label
        self.action = action
        self.disabled = (condition != nil) ?
            EVY.getValueFromText(condition!).value == "false" : false
    }
    
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
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    return EVYButton(label: "Button", condition: "{count(item.title) > 20}", action: {
        print("clicked button")
    })
}
