//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct Child {
    let title: String
    let child: EVYTitleRow
}

struct EVYSegmentedControlRowContent: Decodable {
    struct ChildContent: Decodable {
        let title: String
        let child: EVYTitleRowContent
    }
    let children: [ChildContent]
}

struct EVYSegmentedControlRow: View {
    let children: [Child]
    @State private var selection = 0
    
    var body: some View {
        VStack {
            Picker("Choose", selection: $selection) {
                ForEach(0..<children.count, id: \.self) { index in
                    Text(children[index].title).tag(index)
                }
            }
            .pickerStyle(.segmented)
            .padding()
            children[selection].child
        }
    }
}

#Preview {
    let titleRow1 = EVYTitleRow(title: "Amazing fridge 20423",
                                titleDetail: "$250",
                                subtitle1: ":icon: 88% - 4 items sold",
                                subtitle2: "Rosebery, NSW - Posted on Nov 8th")
    let titleRow2 = EVYTitleRow(title: "Amazing 2",
                                titleDetail: "$250",
                                subtitle1: ":icon: 88% - 4 items sold",
                                subtitle2: "Rosebery, NSW - Posted on Nov 8th")
    let titleRow3 = EVYTitleRow(title: "Amazing 3",
                                titleDetail: "$250",
                                subtitle1: ":icon: 88% - 4 items sold",
                                subtitle2: "Rosebery, NSW - Posted on Nov 8th")
    
    return EVYSegmentedControlRow(children: [
        Child(title: "child1", child: titleRow1),
        Child(title: "child2", child: titleRow2),
        Child(title: "child3", child: titleRow3)])
}
