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
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let pickup = DataConstants.pickupTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "pickupTimeslots", data: pickup)
    
    let delivery = DataConstants.deliveryTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "deliveryTimeslots", data: delivery)
    
    let selling_reasons = DataConstants.selling_reasons.data(using: .utf8)!
    try! EVY.data.create(key: "selling_reasons", data: selling_reasons)
    let conditions = DataConstants.conditions.data(using: .utf8)!
    try! EVY.data.create(key: "conditions", data: conditions)
    let durations = DataConstants.durations.data(using: .utf8)!
    try! EVY.data.create(key: "durations", data: durations)
    let areas = DataConstants.areas.data(using: .utf8)!
    try! EVY.data.create(key: "areas", data: areas)
    
    let json =  SDUIConstants.createItemStep3.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYPage.self, from: json)
}
