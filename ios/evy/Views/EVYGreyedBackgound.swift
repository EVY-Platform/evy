//
//  EVYGreyedBackgound.swift
//  evy
//
//  Created by Geoffroy Lesage on 20/12/2023.
//

import SwiftUI

struct EVYGreyedBackgound: View {
    let content: any View
    let padding: CGFloat
    
    var body: some View {
        VStack{
            VStack{
                AnyView(content)
            }
            .padding(padding)
            .background(Constants.inactiveBackground)
            .cornerRadius(Constants.mainCornerRadius)
        }
    }
}

#Preview {
    return EVYGreyedBackgound(content: Text("I am some content"), padding: Constants.minorPadding)
}
