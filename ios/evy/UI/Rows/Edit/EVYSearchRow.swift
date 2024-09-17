//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let resultKey: String
        let resultFormat: String
        let placeholder: String
    }
}
    
struct EVYSearchRow: View {
    public static let JSONType = "Search"
    
    private let view: EVYSearchRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSearchRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
    
    @State private var showSheet = false
    
    var body: some View {
        VStack(alignment:.leading) {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            EVYSearch(source: view.data,
                      destination: edit.destination,
                      placeholder: view.content.placeholder,
                      resultKey: view.content.resultKey,
                      resultFormat: view.content.resultFormat)
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json = SDUIConstants.tagsRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
