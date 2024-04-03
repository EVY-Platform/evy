//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum EVYRowError: Error {
    case invalidTarget
}

public enum RowCodingKeys: String, CodingKey {
    case type
    case visible
    case view
    case edit
    case action
}

// MARK: JSON Base structures
public class EVYSDUIJSON {
    public struct Action: Decodable {
        let target: Route
        
        private enum ActionCodingKeys: String, CodingKey {
            case target
        }
        
        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: ActionCodingKeys.self)
            let targetString = try container.decode(String.self, forKey: .target)
            let targetSplit = targetString.split(separator: ":")
            if targetSplit.count < 2 {
                throw EVYRowError.invalidTarget
            }
            self.target = Route(
                flowId: String(targetSplit[0]),
                pageId: String(targetSplit[1])
            )
        }
    }
    public struct Edit: Decodable {
        let destination: String
    }
    public struct Placeholder: Decodable {
        let value: String
        let condition: String
    }
    public class Content: Decodable {
        let title: String
    }
    public struct View: Decodable {
        var content: Content
        var placeholder: Placeholder
    }
    public struct Row: Decodable {
        let type: String
        let visible: String
        let view: View
        let edit: Edit
        let action: Action
    }
    
    private enum ContainerContentCodingKeys: String, CodingKey {
        case title
        case children
        case children_data
        case child
    }
    public class ContainerContent: Content {
        let children: [EVYRow]
        let children_data: String?
        let child: EVYRow?
        
        required init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: ContainerContentCodingKeys.self)
            self.children = try container.decode([EVYRow].self, forKey: .children)
            self.children_data = try? container.decode(String.self, forKey: .children_data)
            self.child = try? container.decode(EVYRow.self, forKey: .child)
            
            try super.init(from: decoder)
        }
    }
    public struct ContainerView: Decodable {
        let content: ContainerContent
        let placeholder: Placeholder?
    }
}

// MARK: EVY Row parsing
struct EVYRow: View, Decodable, Identifiable {
    let id = UUID()
    
    public var type: String
    let view: any View

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: RowCodingKeys.self)
        self.type = try container.decode(String.self, forKey: .type)
        
        switch self.type {
            
            // Container rows
            case EVYColumnContainer.JSONType:
                self.view = try EVYColumnContainer(container: container)
            
            case EVYSheetContainerRow.JSONType:
                self.view = try EVYSheetContainerRow(container: container)
        
            // Display rows
            case EVYTextRow.JSONType:
                self.view = try EVYTextRow(container: container)

            // Editable rows
            case EVYInputRow.JSONType:
                self.view = try EVYInputRow(container: container)
            
            case EVYSelectPhotoRow.JSONType:
                self.view = try EVYSelectPhotoRow(container: container)
            
            case EVYButtonRow.JSONType:
                self.view = try EVYButtonRow(container: container)
            
            case EVYDropdownRow.JSONType:
                self.view = try EVYDropdownRow(container: container)
            
            case EVYTextAreaRow.JSONType:
                self.view = try EVYTextAreaRow(container: container)
                    
            default:
                self.view = Text("I am a row")
        }
    }
    
    var body: some View {
        AnyView(view)
    }
}

#Preview {
    let json =  SDUIConstants.page.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYPage.self, from: json)
}
