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
    
struct EVYCalendarRow: View {
    public static let JSONType = "Calendar"
    
    private let view: EVYCalendarRowView
    private let edit: SDUI.Edit
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYCalendarRowView.self, forKey:.view)
        self.edit = try container.decode(SDUI.Edit.self, forKey:.edit)
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
