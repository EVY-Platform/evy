//
//  EVYCalendarRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 11/8/2024.
//

import SwiftUI

struct EVYCalendarRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
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
			case .array(let timeslots):
				return timeslots.count >= min
			default:
				return storedValue.toString().count >= min
			}
		} catch {
			return false
		}
	}
	
	func incompleteMessage() -> String? {
		return edit.validation.message
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
    let pickup = DataConstants.pickupTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "pickupTimeslots", data: pickup)
    
    let delivery = DataConstants.deliveryTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "deliveryTimeslots", data: delivery)
    
    let json =  SDUIConstants.pickupCalendarRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
