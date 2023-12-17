//
//  frodoApp.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

@main
struct frodoApp: App {
    @State private var rows = try! JSONDecoder().decode([EVYRow].self, from: json)
    
    var body: some Scene {
        WindowGroup {
            ContentView(rows: rows)
        }
    }
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
        "type": "Text",
        "content": {
            "title": "Description",
            "content":
                "Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place."
        }
    },
    {
        "type": "TimeslotPicker",
        "content": {
            "icon": ":pickup:",
            "subtitle": "Meet at the pickup address",
            "details": "",
            "timeslots": [
                {
                    "timeslot": 1700894934,
                    "available": true
                },
                {
                    "timeslot": 17008944234,
                    "available": false
                },
                {
                    "timeslot": 1800894934,
                    "available": true
                }
            ]
        }
    }
]
""".data(using: .utf8)!
