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
    private let action: SDUI.Action
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYButtonRowView.self, forKey:.view)
        self.action = try container.decode(SDUI.Action.self, forKey:.action)
    }
    
    var body: some View {
        EVYButton(label: self.view.content.label, action: self.action)
            .frame(maxWidth: .infinity, alignment: .center)
    }
}



#Preview {
    let navigateJson =  SDUIConstants.navigate1ButtonRow.data(using: .utf8)!
    let navigate = try? JSONDecoder().decode(EVYRow.self, from: navigateJson)
    
    let submitJson =  SDUIConstants.submitButtonRow.data(using: .utf8)!
    let submit = try? JSONDecoder().decode(EVYRow.self, from: submitJson)
    
    return VStack {
        navigate
        submit
    }
}
