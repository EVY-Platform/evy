//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYButtonRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let label: String
    }
}
    
struct EVYButtonRow: View {
    public static var JSONType = "Button"
    
    private let view: EVYButtonRowView
    private let action: EVYSDUIJSON.Action
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYButtonRowView.self, forKey:.view)
        self.action = try container.decode(EVYSDUIJSON.Action.self, forKey:.action)
    }
    
    var body: some View {
        EVYButton(label: self.view.content.label, target: self.action.target)
            .frame(maxWidth: .infinity, alignment: .center)
    }
}



#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVYDataManager.i.create(item)

    let navigateJson =  SDUIConstants.navigateButtonRow.data(using: .utf8)!
    let navigate = try? JSONDecoder().decode(EVYRow.self, from: navigateJson)
    
    let submitJson =  SDUIConstants.submitButtonRow.data(using: .utf8)!
    let submit = try? JSONDecoder().decode(EVYRow.self, from: submitJson)
    
    return VStack {
        navigate
        submit
    }
}
