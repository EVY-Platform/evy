//
//  EVYSheetContainer.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSheetContainer: View {
    public static var JSONType = "SheetContainer"
    
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
    let data = EVYData.shared
    let item = DataConstants.item.data(using: .utf8)!
    try! data.set(name: "item", data: item)
    let json = SDUIConstants.sheetContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
