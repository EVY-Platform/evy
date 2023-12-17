//
//  EVYApp.swift
//  EVY
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
                "Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. ",
            "maxLines": "2"
        }
    },
    {
        "type": "Detail",
        "content": {
            "logo": ":alert:",
            "title": "Condition",
            "subtitle": "Like new",
            "detail": ""
        }
    },
    {
        "type": "Detail",
        "content": {
            "logo": ":paper:",
            "title": "Selling reason",
            "subtitle": "Moving out",
            "detail": ""
        }
    },
    {
        "type": "Detail",
        "content": {
            "logo": ":ruler:",
            "title": "Dimensions",
            "subtitle": "250 (w) x 120 (h) x 250 (l)",
            "detail": ""
        }
    }
]
""".data(using: .utf8)!
