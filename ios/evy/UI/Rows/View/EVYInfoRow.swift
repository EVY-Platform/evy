//
//  EVYInfoRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYInfoRowView: Codable {
    let content: ContentData
    
    struct ContentData: Codable {
        let title: String
        let text: String
    }
}

struct EVYInfoRow: View, EVYRowProtocol {
    public static let JSONType = "Info"
    
    private let view: EVYInfoRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYInfoRowView.self, forKey:.view)
    }
    
    var body: some View {
        if view.content.title.count > 0 {
            VStack(alignment:.leading) {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
                EVYTextView(view.content.text, style: .info)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            EVYTextView(view.content.text, style: .info)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","4","rows", "0"])
	}
}
