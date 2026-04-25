//
//  EVYActionRunner.swift
//  evy
//

import Foundation

@MainActor
enum EVYActionRunner {
    static func run(actions: [UI_RowAction],
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

            if !executeTrueBranch {
                let falseBranch = action.`false`.trimmingCharacters(in: .whitespacesAndNewlines)
                if !falseBranch.isEmpty {
                    do {
                        try execute(branch: falseBranch, navigate: navigate)
                    } catch {
                        NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
                    }
                }
                return
            }

            let trueBranch = action.`true`.trimmingCharacters(in: .whitespacesAndNewlines)
            if trueBranch.isEmpty { continue }

            do {
                try execute(branch: trueBranch, navigate: navigate)
            } catch {
                NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
            }
        }
    }

    private static func execute(branch: String,
                                navigate: @escaping (NavOperation) -> Void) throws
    {
        let unwrappedBranch = unwrapActionBranch(branch)

        if let operation = parseColonFormat(unwrappedBranch) ?? parseColonFormat(branch) {
            navigate(operation)
            return
        }

        guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return }

        if let (functionName, functionArgs) = parseFunctionCall(unwrappedBranch) {
            switch functionName {
            case "navigate":
                let args = splitFunctionArguments(functionArgs)
                guard args.count == 2 else {
                    throw EVYError.invalidData(context: "navigate requires flowId and pageId")
                }
                navigate(.navigate(Route(flowId: args[0], pageId: args[1])))
            case "create":
                let args = splitFunctionArguments(functionArgs)
                guard let key = args.first, !key.isEmpty else {
                    throw EVYError.invalidData(context: "create requires a key")
                }
                navigate(.create(key))
            case "close":
                navigate(.close)
            case "highlight_required":
                let args = splitFunctionArguments(functionArgs)
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
            return
        }
    }

    private static func parseColonFormat(_ value: String) -> NavOperation? {
        let parts = value.split(separator: ":")
        guard let keyword = parts.first else { return nil }
        switch keyword {
        case "navigate":
            guard parts.count >= 3 else { return nil }
            return .navigate(Route(flowId: String(parts[1]), pageId: String(parts[2])))
        case "create":
            guard parts.count == 2 else { return nil }
            return .create(String(parts[1]))

        default:
            return nil
        }
    }

    private static func unwrapActionBranch(_ branch: String) -> String {
        guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return branch }
        return String(branch.dropFirst().dropLast())
    }
}
