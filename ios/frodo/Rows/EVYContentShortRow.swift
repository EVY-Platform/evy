//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYContentShortRowContent: Decodable {
    let title: String
    let content: String
}

struct EVYContentShortRow: View {
    let title: String
    let content: String
    
    var body: some View {
        VStack{
            VStack {
                Text(title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, Constants.textLinePadding)
                Text(content)
                    .font(.regularFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.bottom, Constants.textLinePaddingMin)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
    }
}

#Preview {
    EVYContentShortRow(
        title: "Amazing fridge 20423",
        content: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
    )
}
