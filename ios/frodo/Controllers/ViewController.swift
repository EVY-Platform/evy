//
//  ViewController.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import UIKit
import SwiftUI
import Foundation
import Serializable

final class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        
//        let value = try! JSONDecoder().decode(AnyValue.self, from: json)
//        let carousel = value[0]
        
        let vc = UIHostingController(rootView: FCarousel())
        let swiftuiView = vc.view!
        swiftuiView.translatesAutoresizingMaskIntoConstraints = false
        
        addChild(vc)
        view.addSubview(swiftuiView)
        
        NSLayoutConstraint.activate([
            swiftuiView.topAnchor.constraint(equalTo: view.topAnchor),
            swiftuiView.widthAnchor.constraint(equalTo: view.widthAnchor),
            swiftuiView.heightAnchor.constraint(equalToConstant: 350)
        ])
        
        vc.didMove(toParent: self)
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
//        Task {
//            await setup()
//        }
    }
    
    func setup() async {
        do {
            try await FManager.shared.setup()
        } catch (FWSError.loginError) {
            print("Could not log in")
        } catch {
            print("Unexpected error: \(error).")
        }
    }
}

let json = """
[
    {
        "type": "Carousel",
        "content": {
            "photo_ids": ["b", "a", "c"]
        }
    }
]
""".data(using: .utf8)!

//let json = """
//[
//    {
//        "type": "Carousel",
//        "content": {
//            "photo_ids": ["b", "a", "c"]
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
