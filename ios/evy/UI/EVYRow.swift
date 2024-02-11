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

// MARK: JSON Base structures
public class EVYSDUIJSON {
    public class Action: Decodable {
        let type: String
        let target: String
    }
    public class Edit: Decodable {
        let destination: String
        let required: String
    }
    public class Placeholder: Decodable {
        let value: String
        let condition: String
    }
    public class Content: Decodable {
        let title: String
    }
    public class View: Decodable {
        var content: Content
        var placeholder: Placeholder
    }
    public class Row: Decodable {
        let type: String
        let visible: String
        let view: View
        let edit: Edit
        let action: Action
    }
    
    public class ContainerChildren: Decodable {
        let title: String
        let child: EVYRow
    }
    private enum ContainerContentCodingKeys: String, CodingKey {
        case title = "title"
        case children = "children"
        case children_data = "children_data"
    }
    public class ContainerContent: Content {
        let children: ContainerChildren
        let children_data: String
        
        required init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: ContainerContentCodingKeys.self)
            self.children = try container.decode(ContainerChildren.self, forKey: .children)
            self.children_data = try container.decode(String.self, forKey: .children_data)
            
            try super.init(from: decoder)
        }
    }
}

// MARK: EVY Row parsing
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
