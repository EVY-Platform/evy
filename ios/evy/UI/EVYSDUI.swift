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
    
    public struct Action: Decodable {
        let target: ActionTarget
    }
    public enum ActionTarget: Decodable {
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
	public struct Validation: Decodable {
		let required: Bool
		let message: String?
		let minAmount: Int?
		let minValue: Int?
		let minCharacters: Int?
		
		public init(from decoder: Decoder) throws {
			let container = try decoder.container(keyedBy: ValidationCodingKeys.self)
			self.required = try container.decode(String.self, forKey: .required) == "true"
			do {
				self.message = try container.decode(String.self, forKey: .message)
			} catch {
				self.message = nil
			}
			do {
				self.minAmount = Int(try container.decode(String.self, forKey: .minAmount))!
			} catch {
				self.minAmount = nil
			}
			do {
				self.minValue = Int(try container.decode(String.self, forKey: .minValue))!
			} catch {
				self.minValue = nil
			}
			do {
				self.minCharacters = Int(try container.decode(String.self, forKey: .minCharacters))!
			} catch {
				self.minCharacters = nil
			}
		}
	}
    public struct Edit: Decodable {
        let destination: String
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
    
	public struct ContainerChild: Decodable {
		let title: String
		let child: EVYRow
	}
    public class ContainerContent: Decodable {
        let children: [ContainerChild]
		let required_children: String
        let children_data: String?
        let child: EVYRow?
    }
    public struct ContainerView: Decodable {
        let content: ContainerContent
    }
}
