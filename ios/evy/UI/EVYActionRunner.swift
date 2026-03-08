//
//  EVYActionRunner.swift
//  evy
//
//  Created by Cursor on 8/3/2026.
//

import Foundation

public enum SDUI_ActionTarget: Codable {
    case navigate(Route)
    case create(String)
    case close

    private enum EVYActionError: Error {
        case invalid
        case missingKeywords
        case tooManyKeywords
    }

    /// Parse target string for use in row behaviour.
    public static func parse(_ value: String) throws -> SDUI_ActionTarget {
        let valueSplit = value.split(separator: ":")
        if valueSplit.count < 1 {
            throw EVYActionError.missingKeywords
        }
        if valueSplit.count > 3 {
            throw EVYActionError.tooManyKeywords
        }
        switch valueSplit.first {
        case "navigate":
            guard valueSplit.count >= 3 else { throw EVYActionError.invalid }
            return .navigate(Route(
                flowId: String(valueSplit[1]),
                pageId: String(valueSplit[2])
            ))
        case "create":
            guard valueSplit.count == 2 else { throw EVYActionError.invalid }
            return .create(String(valueSplit[1]))
        case "close":
            return .close
        default:
            throw EVYActionError.invalid
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        guard let value = try? container.decode(String.self) else {
            throw EVYActionError.invalid
        }
        self = try SDUI_ActionTarget.parse(value)
    }
}

@MainActor
enum EVYActionRunner {
    static func run(actions: [SDUI_RowAction],
                    navigate: @escaping (NavOperation) -> Void)
    {
        guard !actions.isEmpty else { return }
        
        for action in actions {
            let condition = action.condition.trimmingCharacters(in: .whitespacesAndNewlines)
            let executeTrueBranch: Bool
            
            if condition.isEmpty {
                executeTrueBranch = true
            } else {
                executeTrueBranch = (try? EVY.evaluateFromText(condition)) ?? false
            }
            
            let branch = executeTrueBranch ? action.`true` : action.`false`
            let trimmedBranch = branch.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmedBranch.isEmpty { continue }
            
            do {
                try execute(branch: trimmedBranch, navigate: navigate)
            } catch {
                NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
            }
        }
    }
    
    private static func execute(branch: String,
                                navigate: @escaping (NavOperation) -> Void) throws
    {
		let unwrappedBranch = unwrapActionBranch(branch)
		
        if let target = try? SDUI_ActionTarget.parse(branch) {
            perform(target: target, navigate: navigate)
            return
        }
        else if let target = try? SDUI_ActionTarget.parse(unwrappedBranch) {
            perform(target: target, navigate: navigate)
            return
		} else if let (functionName, functionArgs) = EVYInterpreter.parseFunctionCall(unwrappedBranch) {
			switch functionName {
			case "navigate":
				let args = splitArguments(functionArgs)
				guard args.count == 2 else {
					throw EVYError.invalidData(context: "navigate requires flowId and pageId")
				}
				navigate(.navigate(Route(flowId: args[0], pageId: args[1])))
			case "create":
				let args = splitArguments(functionArgs)
				guard let key = args.first, !key.isEmpty else {
					throw EVYError.invalidData(context: "create requires a key")
				}
				navigate(.create(key))
			case "close":
				navigate(.close)
			case "highlight_required":
				let args = splitArguments(functionArgs)
				let alias = args.first ?? "field"
				let fieldName = alias
					.replacingOccurrences(of: "_", with: " ")
					.trimmingCharacters(in: .whitespacesAndNewlines)
				let readableField = fieldName.isEmpty ? "Field" : fieldName.capitalized
				navigate(.highlightRequired(readableField))
			default:
				throw EVYError.invalidData(context: "Unsupported action function: \(functionName)")
			}
		} else {
			throw EVYError.invalidData(context: "Unknown action branch: \(branch)")
		}
    }
    
    private static func perform(target: SDUI_ActionTarget,
                                navigate: @escaping (NavOperation) -> Void)
    {
        switch target {
        case let .navigate(route):
            navigate(.navigate(route))
        case let .create(key):
            navigate(.create(key))
        case .close:
            navigate(.close)
        }
    }
    
    private static func unwrapActionBranch(_ branch: String) -> String {
        guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return branch }
        return String(branch.dropFirst().dropLast())
    }
    
    private static func splitArguments(_ args: String) -> [String] {
        args
            .split(separator: ",", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
    }
}
