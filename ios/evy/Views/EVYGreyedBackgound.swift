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
    let json = """
    {
        "type": "Title",
        "content": {
            "title": "Amazing Fridge",
            "title_detail": "$250",
            "subtitle_1": "::star.square.on.square.fill:: 88% - 4 items sold",
            "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
        }
    }
    """.data(using: .utf8)!
    let myview = try! JSONDecoder().decode(EVYRow.self, from: json)
    
    return EVYGreyedBackgound(content: myview, padding: Constants.minorPadding)
}
