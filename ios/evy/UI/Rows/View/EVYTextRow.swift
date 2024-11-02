//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYTextRowView: Decodable {
    let content: ContentData
    let max_lines: String
    
    struct ContentData: Decodable {
        let title: String
        let text: String
    }
}

struct EVYTextRow: View, EVYRowProtocol {
    public static let JSONType = "Text"
    
    private let view: EVYTextRowView
    @State private var showSheet = false
	@State private var canBeExpanded: Bool = false
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYTextRowView.self, forKey:.view)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            EVYTextView(view.content.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(Int(view.max_lines) ?? 1)
                .background {
                    ViewThatFits(in: .vertical) {
                        EVYTextView(view.content.text).hidden()
                        Color.clear.onAppear {
                            canBeExpanded = true
                        }
                    }
                }
                .sheet(isPresented: $showSheet, content: {
                    EVYTextView(view.content.text)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.top, Constants.majorPadding)
                    .presentationDragIndicator(.visible)
                })
            if canBeExpanded {
                EVYTextView("Read more")
                    .foregroundStyle(Constants.actionColor)
                    .padding(.vertical, Constants.padding)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if canBeExpanded {
                showSheet.toggle()
            }
        }
    }
}



#Preview {
    let json = SDUIConstants.textRow.data(using: .utf8)!
    let json2 =  SDUIConstants.textRowShort.data(using: .utf8)!
    return VStack {
        try? JSONDecoder().decode(EVYRow.self, from: json)
        try? JSONDecoder().decode(EVYRow.self, from: json2)
    }
}
