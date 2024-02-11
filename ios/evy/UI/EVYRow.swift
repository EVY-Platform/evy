//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum RowCodingKeys: String, CodingKey {
    case type = "type"
    case visible = "visible"
    case view = "view"
    case edit = "edit"
    case action = "action"
}

struct EVYRow: View, Decodable {
    public var type: String
    var view: any View

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: RowCodingKeys.self)
        self.type = try container.decode(String.self, forKey: .type)
        
        switch self.type {
        case EVYTextRow.JSONType:
            self.view = try EVYTextRow(container: container)
            
        default:
            self.view = Text("I am a row")
        }
    }
    
    var body: some View {
        AnyView(view)
    }
}

#Preview {
    let json =  DataConstants.testRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
