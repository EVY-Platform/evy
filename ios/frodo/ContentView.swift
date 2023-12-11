//
//  ContentView.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import Foundation
import Serializable

struct EVYRowData {
    let id: String
    let images: [String]
    let type: String
}

//protocol EVYRow: Decodable {
//    var type: String { get }
//}

//{
//    "title": "Amazing Fridge",
//    "title_detail": "$250",
//    "subtitle_1": ":star_doc: 88% - 4 items sold",
//    "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
//}

struct ContentView: View {
//    let rows = try! JSONDecoder().decode([EVYRowData].self, from: json)
    
    let rows = [
        EVYRowData(id: "carousel", images: ["printer_logo","printer"], type: "carousel"),
        EVYRowData(id: "title", images: ["printer"], type: "carousel")
    ]
    
    var body: some View {
//        let row = rows[0]
//        
//        EVYCarouselRow(imageNames: row.content.photo_ids)
//            .frame(height: 250)
//            .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        
        
        List(rows, id: \.id) { row in
            if (row.id == "carousel") {
                EVYCarouselRow(imageNames: row.images)
                    .frame(height: 250)
                    .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
            }
            else {
                EVYTitleRow(title: "Amazing fridge",
                            titleDetail: "Details",
                            subtitle1: "sub 1",
                            subtitle2: "sub 2")
            }
        }
        .listStyle(PlainListStyle())
    }
}

#Preview {
    ContentView()
}

let json = """
[
    {
        "type": "Carousel",
        "content": {
            "photo_ids": ["printer_logo", "printer"]
        }
    },
    {
        "type": "Title",
        "content": {
            "title": "Amazing Fridge",
            "title_detail": "$250",
            "subtitle_1": ":star_doc: 88% - 4 items sold",
            "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
        }
    }
]
""".data(using: .utf8)!


//let json = """
//[
//    {
//        "type": "Carousel",
//        "content": {
//            "photo_ids": ["printer_logo", "printer"]
//        }
//    },
//    {
//        "type": "Title",
//        "content": {
//            "title": "Amazing Fridge",
//            "title_detail": "$250",
//            "subtitle_1": ":star_doc: 88% - 4 items sold",
//            "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
//        }
//    },
//    {
//        "type": "SegmentedControl",
//        "content": {
//            "children": [
//                {
//                    "title": "Pickup",
//                    "child": {
//                        "type": "TimeslotPicker",
//                        "content": {
//                            "icon": ":pickup:",
//                            "subtitle": "Meet at the pickup address",
//                            "details": "",
//                            "timeslots": [
//                                {
//                                    "timeslot": 1700894934,
//                                    "available": true
//                                },
//                                {
//                                    "timeslot": 17008944234,
//                                    "available": false
//                                },
//                                {
//                                    "timeslot": 1800894934,
//                                    "available": true
//                                }
//                            ]
//                        }
//                    }
//                },
//                {
//                    "title": "Deliver",
//                    "child": {
//                        "type": "TimeslotPicker",
//                        "content": {
//                            "icon": ":car:",
//                            "subtitle": "Delivered at your door",
//                            "details": "+ $5.00",
//                            "timeslots": [
//                                {
//                                    "timeslot": 1700894934,
//                                    "available": true
//                                },
//                                {
//                                    "timeslot": 17008944234,
//                                    "available": false
//                                },
//                                {
//                                    "timeslot": 1800894934,
//                                    "available": true
//                                }
//                            ]
//                        }
//                    }
//                },
//                {
//                    "title": "Ship",
//                    "child": {
//                        "type": "ContentLong",
//                        "content": {
//                            "title": "Australia Post",
//                            "logo": "image_id",
//                            "subtitle": "2-5 days once deposited",
//                            "details": "$25.00",
//                            "disclaimer":
//                                ":lock: Your money will be held until Australia Post confirms delivery "
//                        }
//                    }
//                }
//            ]
//        }
//    },
//    {
//        "type": "ContentShort",
//        "content": {
//            "title": "Description",
//            "content":
//                "Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place."
//        }
//    },
//    {
//        "type": "Condition",
//        "content": {
//            "icon": ":paper:",
//            "title": "Selling reason",
//            "subtitle": "Moving out"
//        }
//    },
//    {
//        "type": "Condition",
//        "content": {
//            "icon": ":ruler:",
//            "title": "Dimensions",
//            "subtitle": "250 (w) x 120 (h) x 250 (l)"
//        }
//    },
//    {
//        "type": "Condition",
//        "content": {
//            "icon": ":alert:",
//            "title": "Condition",
//            "subtitle": "Like new"
//        }
//    },
//    {
//        "type": "Address",
//        "content": {
//            "title": "Pickup location",
//            "line_1": "23-25 Rosebery Avenue",
//            "line_2": "2018 Rosebery, NSW",
//            "location": {
//                "latitude": 45.323124,
//                "longitude": -3.424233
//            }
//        }
//    },
//    {
//        "type": "PaymentOptions",
//        "content": {
//            "title": "Payment methods accepted",
//            "options": [
//                {
//                    "icon": ":visa:",
//                    "label": "Card",
//                    "disclaimer": ":lock: Benefit from EVY buyer protection"
//                },
//                {
//                    "icon": ":dollar:",
//                    "label": "Cash",
//                    "disclaimer": ""
//                }
//            ]
//        }
//    }
//]
//""".data(using: .utf8)!
