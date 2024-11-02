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
    
struct EVYButtonRow: View, EVYRowProtocol {
    @Environment(\.navigate) private var navigate
    
    public static let JSONType = "Button"
    
    private let view: EVYButtonRowView
    private let action: SDUI.Action
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYButtonRowView.self, forKey:.view)
        action = try container.decode(SDUI.Action.self, forKey:.action)
    }
    
    private func performAction() -> Void {
        switch action.target {
        case .navigate(let route):
            navigate(NavOperation.navigate(route))
        case .submit:
            navigate(NavOperation.submit)
        case .close:
            navigate(NavOperation.close)
        }
    }
    
    var body: some View {
        EVYButton(label: view.content.label, action: performAction)
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, Constants.minorPadding)
        .padding(.bottom, Constants.majorPadding)
    }
}



#Preview {
    let json =  SDUIConstants.navigate3ButtonRow.data(using: .utf8)!
    let button = try? JSONDecoder().decode(EVYRow.self, from: json)
    
    return button
}
