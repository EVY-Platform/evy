//
//  EVYTextActionRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextActionRowView: Codable {
    let content: ContentData
    
    struct ContentData: Codable {
        let title: String
        let text: String
        let placeholder: String
        let action: String
    }
}

struct EVYTextActionRow: View, EVYRowProtocol {
    public static let JSONType = "TextAction"
    
    private let view: EVYTextActionRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYTextActionRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            HStack {
				EVYTextView(view.content.text,
							placeholder: view.content.placeholder,
							style: .info)
				.frame(maxWidth: .infinity, alignment: .leading)
				EVYTextView(view.content.action, style: .action)
            }
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","2","rows", "0", "view", "content", "children", "0", "child", "view", "content", "children", "1", "child"])
	}
}
