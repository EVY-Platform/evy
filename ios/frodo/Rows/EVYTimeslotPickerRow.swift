//
//  EVYTimeslotPickerRow.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

private struct JSONData: Decodable {
    let icon: String
    let subtitle: String
    let details: String
//    let timeslots: [EVYTimeslot]
}

struct EVYTimeslotPickerRow: View {
//    public static var JSONType = "TimeslotPicker"
//    
//    private let icon: String
//    private let subtitle: String
//    private let details: String
//    private let timeslots: [EVYTimeslot]
//    
//    init(container: KeyedDecodingContainer<CodingKeys>) throws {
//        let parsedData = try container.decode(JSONData.self, forKey:.content)
//        self.icon = parsedData.icon
//        self.subtitle = parsedData.subtitle
//        self.details = parsedData.details
//        self.timeslots = parsedData.timeslots
//    }
//    
    var body: some View {
//        VStack{
//            HStack {
//                Image(systemName: icon)
//                    .font(.regularFont)
//                Text(subtitle)
//                    .font(.regularFont)
//                    .frame(maxWidth: .infinity, alignment: .leading)
//                Text(details)
//                    .font(.detailFont)
//                    .frame(alignment: .trailing)
//            }
//            .padding(.bottom, Constants.textHeadingLinePadding)
//
////            EVYTimeslotPicker(timeslots: timeslots)
//        }
//        .frame(height: 200)
//        .padding()
//        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        Text("Hello")
    }
}

//#Preview {
//    let json = """
//    {
//        "type": "TimeslotPicker",
//        "content": {
//            "icon": "truck.box.badge.clock",
//            "subtitle": "Meet at the pickup address",
//            "details": "+ $5.50",
//            "timeslots": [
//                {
//                    "timeslot": 1700894934,
//                    "available": true
//                },
//                {
//                    "timeslot": 17008944234,
//                    "available": false
//                },
//                {
//                    "timeslot": 1800894934,
//                    "available": true
//                }
//            ]
//        }
//    }
//    """.data(using: .utf8)!
//    return try! JSONDecoder().decode(EVYRow.self, from: json)
//}
