//
//  ContentView.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import Foundation
import Serializable

struct ContentView: View {
    @State private var rows = try! JSONDecoder().decode([EVYRow].self, from: json)
    
    var body: some View {
        List(rows, id: \.id) { row in
            switch row.content {
            case .carousel(let carousel):
                EVYCarouselRow(imageNames: carousel.photo_ids)
                    .frame(height: 250)
                    .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
            case .title(let title):
                EVYTitleRow(title: title.title,
                            titleDetail: title.title_detail,
                            subtitle1: title.subtitle_1,
                            subtitle2: title.subtitle_2)
            case .contentShort(let contentShort):
                EVYContentShortRow(title: contentShort.title,
                                   content: contentShort.content)
            default:
                fatalError("Unknown type of content.")
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
    },
    {
        "type": "ContentShort",
        "content": {
            "title": "Description",
            "content":
                "Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place."
        }
    },
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
