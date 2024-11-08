//
//  EVYCalendarRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 11/8/2024.
//

import SwiftUI

struct EVYCalendarRowView: Codable {
    let content: ContentData
    
    struct ContentData: Codable {
        let title: String
        let primary: String
        let secondary: String
    }
}
    
struct EVYCalendarRow: View, EVYRowProtocol {
    public static let JSONType = "Calendar"
    
    private let view: EVYCalendarRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYCalendarRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}

		do {
			let storedValue = try EVY.getDataFromText(edit.destination!)
			let min = edit.validation.minAmount ?? 1
			switch storedValue {
			case let .array(timeslots):
				let selectedTimeslots = timeslots.filter {
					$0.parseProp(props: ["selected"]).toString() == "true"
				}
				return selectedTimeslots.count >= min
			default:
				return storedValue.toString().count >= min
			}
		} catch {
			return false
		}
	}
	
	func incompleteMessage() -> String? {
		edit.validation.message
	}
	
	func incompleteMessages() -> [String] {
		edit.validation.message != nil ? [edit.validation.message!] : []
	}
    
    var body: some View {
        EVYCalendar(primary: view.content.primary,
                    secondary: view.content.secondary)
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","2","rows", "0", "view", "content", "children", "0", "child", "view", "content", "children", "4", "child"])
	}
}
