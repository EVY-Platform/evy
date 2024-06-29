//
//  EVYListContainer.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYListContainer: View {
    public static var JSONType = "ListContainer"
    
    private let view: SDUI.ContainerView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SDUI.ContainerView.self, forKey:.view)
    }
    
    var body: some View {
        VStack {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Constants.minPading)
            }
            VStack(alignment: .leading) {
                ForEach(view.content.children, id: \.id) { child in
                    child
                }
            }
        }
    }
}

#Preview {
    let json = SDUIConstants.listContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}

