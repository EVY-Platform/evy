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
        case tooManyKeywords
    }
    
    public struct Action: Codable {
        let target: ActionTarget
    }
    public enum ActionTarget: Codable {
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
                throw EVYActionError.tooManyKeywords
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
	
	private enum ValidationCodingKeys: String, CodingKey {
		case required
		case message
		case minAmount
		case minValue
		case minCharacters
	}
	public struct Validation: Codable {
		let required: Bool
		let message: String?
		let minAmount: Int?
		let minValue: Int?
		let minCharacters: Int?
		
		public init(from decoder: Decoder) throws {
			let container = try decoder.container(keyedBy: ValidationCodingKeys.self)
			required = try container.decode(String.self, forKey: .required) == "true"
			do {
				message = try container.decode(String.self, forKey: .message)
			} catch {
				message = nil
			}
			do {
				minAmount = Int(try container.decode(String.self, forKey: .minAmount))!
			} catch {
				minAmount = nil
			}
			do {
				minValue = Int(try container.decode(String.self, forKey: .minValue))!
			} catch {
				minValue = nil
			}
			do {
				minCharacters = Int(try container.decode(String.self, forKey: .minCharacters))!
			} catch {
				minCharacters = nil
			}
		}
	}
    public struct Edit: Codable {
        let destination: String?
		let validation: Validation
    }
    public class Content: Decodable {
        let title: String
    }
    public struct View: Decodable {
        let content: Content
    }
    public struct Row: Decodable {
        let type: String
        let view: View
        let edit: Edit
        let action: Action
    }
    
	public struct ContainerChild: Codable {
		let title: String
		let child: EVYRow
	}
    public class ContainerContent: Codable {
        let children: [ContainerChild]
        let child: EVYRow?
    }
    public struct ContainerView: Codable {
        let content: ContainerContent
    }
}
