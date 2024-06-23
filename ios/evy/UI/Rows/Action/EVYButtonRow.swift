//
//  EVYButtonRow.swift
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
    @State private var disabled: Bool
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYButtonRowView.self, forKey:.view)
        self.action = try container.decode(SDUI.Action.self, forKey:.action)
        
        if let condition = action.condition {
            self.disabled = EVY.getValueFromText(condition).value == "false"
        } else {
            self.disabled = false
        }
    }
    
    var body: some View {
        EVYButton(label: view.content.label,
                  target: action.target,
                  disabled: $disabled)
            .frame(maxWidth: .infinity, alignment: .center)
    }
}



#Preview {
    let json =  SDUIConstants.navigate3ButtonRow.data(using: .utf8)!
    let button = try? JSONDecoder().decode(EVYRow.self, from: json)
    
    return button
}
