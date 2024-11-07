//
//  EVYInputListRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 21/8/2024.
//

import SwiftUI

struct EVYInputListRowView: Codable {
    let content: ContentData
    let data: String
    
    struct ContentData: Codable {
        let title: String
        let format: String
        let placeholder: String
    }
}
    
struct EVYInputListRow: View, EVYRowProtocol {
    public static let JSONType = "InputList"
    
    private let view: EVYInputListRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYInputListRowView.self, forKey:.view)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            EVYInputList(data: view.data,
                         format: view.content.format,
                         placeholder: view.content.placeholder)
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","0","rows", "6", "view", "content", "child"])
	}
}
