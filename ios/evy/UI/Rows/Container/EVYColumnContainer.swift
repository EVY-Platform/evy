//
//  EVYColumnContainer.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYColumnContainer: View {
    public static var JSONType = "ColumnContainer"
    
    private let view: SDUI.ContainerView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SDUI.ContainerView.self, forKey:.view)
    }
    
    var body: some View {
        VStack(alignment:.leading) {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.minPading)
            }
            HStack(alignment: .top) {
                ForEach(view.content.children, id: \.id) { child in
                    child
                }
            }
        }
    }
}

#Preview {
    let json = SDUIConstants.columnContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
