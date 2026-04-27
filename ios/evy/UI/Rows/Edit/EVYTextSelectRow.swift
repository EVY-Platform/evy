//
//  EVYTextSelectRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextSelectRow: View, EVYRowProtocol {
	public static let JSONType = "TextSelect"

	private let view: TextSelectRowViewData
	private let destination: String
	private let actions: [UI_RowAction]
	private let value: EVYJson
	private let selected: EVYState<Bool>

	init?(view: TextSelectRowViewData, destination: String, actions: [UI_RowAction]) {
		guard !destination.isEmpty else { return nil }
		self.view = view
		self.destination = destination
		self.actions = actions
		self.selected = EVYState(watch: destination, setter: {
			do {
				return try EVY.evaluateFromText($0)
			} catch {
				#if DEBUG
				print("[EVYTextSelectRow] Error evaluating selection: \(error)")
				#endif
				return false
			}
		})
		let temporaryId = UUID().uuidString
		let temporaryScopeId = EVYDraft.createMergeScopeId(flowId: "temporary", entityKey: temporaryId)

		do {
			try EVY.updateValue(view.content.text, at: temporaryId, scopeId: temporaryScopeId)
		} catch {
			#if DEBUG
			print("[EVYTextSelectRow] Failed to store temporary value: \(error)")
			#endif
			return nil
		}

		guard let binding = try? EVY.data.draftBinding(fromParsedProps: temporaryId, scopeId: temporaryScopeId) else {
			#if DEBUG
			print("[EVYTextSelectRow] No draft binding found for '\(temporaryId)'")
			#endif
			return nil
		}

		guard let draft = EVY.data.draftIfPresent(binding: binding) else {
			#if DEBUG
			print("[EVYTextSelectRow] No draft present for binding '\(binding)'")
			#endif
			return nil
		}

		do {
			self.value = try draft.decoded()
		} catch {
			#if DEBUG
			print("[EVYTextSelectRow] Failed to decode draft: \(error)")
			#endif
			return nil
		}
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			EVYSelectItem(
				destination: destination,
				value: value,
				format: "",
				selectionStyle: .multi,
				target: .single_bool,
				textStyle: .info
			)
			.frame(maxWidth: .infinity, alignment: .leading)
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["2", "pages", "3", "rows", "1", "view", "content", "children", "0"])
	}
}
