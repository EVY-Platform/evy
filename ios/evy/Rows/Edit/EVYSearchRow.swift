//
//  EVYDropdownRow.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

struct EVYSearchRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let value: String
        let placeholder: String
    }
}
    
struct EVYSearchRow: View {
    public static var JSONType = "Search"
    
    private let view: EVYSearchRowView
    private let edit: SDUI.Edit
    
    @ObservedObject var searchController = EVYSearchAPI()
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSearchRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
    
    @State private var showSheet = false
    
    var body: some View {
        VStack {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Constants.minorPadding)
            }
            EVYSearch(searchController: searchController,
                      placeholder: view.content.placeholder)
        }
    }
}


#Preview {
    let json =  SDUIConstants.searchRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
