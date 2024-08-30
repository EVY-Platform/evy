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
        let value: String
        let placeholder: String
    }
}
    
struct EVYSearchRow: View {
    public static let JSONType = "Search"
    
    private let view: EVYSearchRowView
    private let edit: SDUI.Edit
    
    @ObservedObject var searchController: EVYSearchController
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSearchRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
        
        self.searchController = EVYSearchController(source: view.data,
                                                    destination: edit.destination)
    }
    
    @State private var showSheet = false
    
    var body: some View {
        VStack(alignment:.leading) {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.minPading)
            }
            EVYSearch(searchController: searchController,
                      placeholder: view.content.placeholder)
        }.onAppear(perform: {
            searchController.refresh()
        })
    }
}


#Preview {
    let json =  SDUIConstants.searchTagsRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
