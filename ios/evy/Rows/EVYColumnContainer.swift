//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYColumnContainer: View {
    public static var JSONType = "ColumnContainer"
    
    private let view: EVYSDUIJSON.ContainerView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSDUIJSON.ContainerView.self, forKey:.view)
    }
   
    @State private var title: String = ""
    
    var body: some View {
        VStack(spacing: Constants.textLinePadding) {
            if (view.content.title.count > 0) {
                EVYText(view.content.title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
            }
            HStack {
                ForEach(view.content.children, id: \.id) { child in
                    child.child
                }
            }
        }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    let _ = try! EVYDataManager.i.create(item)
    
    let json = SDUIConstants.columnContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
