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
    
    var body: some View {
        HStack {
            ForEach(view.content.children, id: \.id) { child in
                child.child
            }
        }
    }
}

#Preview {
    let json = DataConstants.columnContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
