//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum RowCodingKeys: String, CodingKey {
    case type
    case view
    case edit
    case action
}

public enum EVYRowError: Error {
	case cannotParseRow
}

protocol EVYRowProtocol: View {
	static var JSONType: String { get }
	func complete() -> Bool
}

struct EVYRow: View, Decodable, Identifiable {
    let id = UUID()
    
    let type: String
	let view: any EVYRowProtocol

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: RowCodingKeys.self)
        self.type = try container.decode(String.self, forKey: .type)
        
        switch self.type {
            
			// Container rows
            case EVYColumnContainerRow.JSONType:
                self.view = try EVYColumnContainerRow(container: container)
            
            case EVYListContainerRow.JSONType:
                self.view = try EVYListContainerRow(container: container)
            
            case EVYSelectSegmentContainerRow.JSONType:
                self.view = try EVYSelectSegmentContainerRow(container: container)
            
            case EVYSheetContainerRow.JSONType:
                self.view = try EVYSheetContainerRow(container: container)
        
            // Display rows
            case EVYInfoRow.JSONType:
                self.view = try EVYInfoRow(container: container)
            
            case EVYTextRow.JSONType:
                self.view = try EVYTextRow(container: container)
            
            case EVYTextActionRow.JSONType:
                self.view = try EVYTextActionRow(container: container)
            
            case EVYInputListRow.JSONType:
                self.view = try EVYInputListRow(container: container)

            // Editable rows
            case EVYDropdownRow.JSONType:
                self.view = try EVYDropdownRow(container: container)
            
            case EVYInlinePickerRow.JSONType:
                self.view = try EVYInlinePickerRow(container: container)
            
            case EVYInputRow.JSONType:
                self.view = try EVYInputRow(container: container)
            
            case EVYSearchRow.JSONType:
                self.view = try EVYSearchRow(container: container)
            
            case EVYSelectPhotoRow.JSONType:
                self.view = try EVYSelectPhotoRow(container: container)
            
            case EVYTextAreaRow.JSONType:
                self.view = try EVYTextAreaRow(container: container)
            
            case EVYCalendarRow.JSONType:
                self.view = try EVYCalendarRow(container: container)
            
            // Action rows
            case EVYButtonRow.JSONType:
                self.view = try EVYButtonRow(container: container)
            
            case EVYTextSelectRow.JSONType:
                self.view = try EVYTextSelectRow(container: container)
                    
            default:
				throw EVYRowError.cannotParseRow
        }
    }
	
	func complete() -> Bool {
		view.complete()
	}
    
    var body: some View {
        AnyView(view)
    }
}
