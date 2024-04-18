//
//  EVYSDUI.swift
//  evy
//
//  Created by Geoffroy Lesage on 5/4/2024.
//

import Foundation

public class SDUI {
    private enum EVYActionError: Error {
        case invalid
        case missingKeywords
        case toomanyKeywords
    }
    
    public enum Action: Decodable {
        case navigate(Route)
        case submit
        case close
        
        public init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            
            guard let value = try? container.decode(String.self) else {
                throw EVYActionError.invalid
            }
            
            let valueSplit = value.split(separator: ":")
            if valueSplit.count < 1 {
                throw EVYActionError.missingKeywords
            }
            if valueSplit.count > 3 {
                throw EVYActionError.toomanyKeywords
            }
            switch valueSplit.first {
            case "navigate":
                self = .navigate(Route(
                    flowId: String(valueSplit[1]),
                    pageId: String(valueSplit[2])
                ))
            case "submit":
                self = .submit
            case "close":
                self = .close
            default:
                throw EVYActionError.invalid
            }
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
    
    public enum ContainerContentCodingKeys: String, CodingKey {
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
