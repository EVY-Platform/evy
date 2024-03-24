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
        VStack {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .font(.evy)
                    .frame(maxWidth: .infinity, alignment: .leading)
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
