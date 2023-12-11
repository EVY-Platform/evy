//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

//struct EVYTitleRowData: Decodable {
//    let type: String
//    struct content: Decodable {
//        let title: String
//        let titleDetail: String
//        let subtitle1: String
//        let subtitle2: String
//    }
//}

struct EVYTitleRow: View {
    let title: String
    let titleDetail: String
    let subtitle1: String
    let subtitle2: String
    
    var body: some View {
        HStack {
            Text(title)
            Text(titleDetail)
            Text(subtitle1)
            Text(subtitle2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
    }
}

#Preview {
    EVYTitleRow(title: "Title",
                titleDetail: "Title Detail",
                subtitle1: "Subtitle 1",
                subtitle2: "Subtitle 2")
}
