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
            
            case EVYListContainer.JSONType:
                self.view = try EVYListContainer(container: container)
            
            case EVYSelectContainerRow.JSONType:
                self.view = try EVYSelectContainerRow(container: container)
            
            case EVYSheetContainerRow.JSONType:
                self.view = try EVYSheetContainerRow(container: container)
        
            // Display rows
            case EVYInfoRow.JSONType:
                self.view = try EVYInfoRow(container: container)
            
            case EVYTextRow.JSONType:
                self.view = try EVYTextRow(container: container)
            
            case EVYTextActionRow.JSONType:
                self.view = try EVYTextActionRow(container: container)

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
            
            // Action rows
            case EVYButtonRow.JSONType:
                self.view = try EVYButtonRow(container: container)
                    
            default:
                self.view = EVYTextView("I am a row")
        }
    }
    
    var body: some View {
        AnyView(view)
    }
}
