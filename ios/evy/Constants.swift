//
//  AppConstants.swift
//  EVY
//
//  Created by Clemence Chalot on 11/12/2023.
//

import SwiftUI


extension Font {
    static let titleFont = Font.system(size: 20)
    static let detailFont = Font.system(size: 16)
    static let regularFont = Font.system(size: 16)
    static let smallFont = Font.system(size: 14)
    static let buttonFont = Font.system(size: 24)
}

struct Constants {
    static let iconSeparator: String = "::"
    
    static let textLinePadding: CGFloat = 4
    static let textLinePaddingMin: CGFloat = 1
    
    static let majorPadding: CGFloat = 16
    static let minorPadding: CGFloat = 8
    static let minPadding: CGFloat = 2
    
    static let columnPadding: CGFloat = 4
    
    static let mainCornerRadius: CGFloat = 10
    
    static let largeIconSize: CGFloat = 40
    static let regularIconSize: CGFloat = 30
    static let smallIconSize: CGFloat = 20

    static let buttonColor: Color = Color(#colorLiteral(red: 0.4745, green: 0.898, blue: 0.9569, alpha: 1))
    static let buttonDisabledColor: Color = Color(#colorLiteral(red: 0.6000000238, green: 0.6000000238, blue: 0.6000000238, alpha: 1))
    static let textButtonColor: Color = .blue
    static let inactiveBackground: Color = Color(#colorLiteral(red: 0.9621850848, green: 0.9621850848, blue: 0.9621850848, alpha: 1))
}

struct DataConstants {
    static let pages = "[\(page)]"
    static let page = """
        {
            "id": "b",
            "flow_id": "create_item_id",
            "name": "Test",
            "rows": \(rows)
        }
    """
    
    static let rows = "[\(testRow), \(textRow), \(columnContainerRow)]"
    static let testRow = """
        {"type": "test"}
    """
    static let textRow = """
        {
            "type": "Text",
            "view": {
                "content": {
                    "title": "Description",
                    "text": "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
                },
                "max_lines": "2"
            }
        }
    """
    static let columnContainerRow = """
        {
            "type": "ColumnContainer",
            "view": {
                "content": {
                    "title": "Column Container",
                    "children": [\(textRow), \(textRow)]
                }
            }
        }
    """
}
