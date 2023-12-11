//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct EVYTitleRowContent: Decodable {
    let title: String
    let title_detail: String
    let subtitle_1: String
    let subtitle_2: String
}

struct EVYTitleRow: View {
    let title: String
    let titleDetail: String
    let subtitle1: String
    let subtitle2: String
    
    var body: some View {
        VStack{
            HStack {
                Text(title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(titleDetail)
                    .font(.detailFont)
            }
            .padding(.bottom, 15)

            Text(subtitle1)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 1)
            Text(subtitle2)
                .foregroundStyle(.gray)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
               
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
    }
}

#Preview {
    EVYTitleRow(title: "Amazing fridge 20423",
                titleDetail: "$250",
                subtitle1: ":icon: 88% - 4 items sold",
                subtitle2: "Rosebery, NSW - Posted on Nov 8th")
}
