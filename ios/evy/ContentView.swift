//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct ContentView: View {
    @State private var rows = try! JSONDecoder().decode([EVYRow].self, from: json)
    
    var body: some View {
        List(rows.indices, id: \.self) { index in
            rows[index]
                .padding(.bottom, Constants.majorPadding)
                .listRowSeparator(.hidden)
        }
        .listStyle(PlainListStyle())
        .ignoresSafeArea()
    }
}

let json = """
[
    {
        "type": "SegmentedControl",
        "content": {
            "children": [
                {
                    "title": "Pickup",
                    "children": [{
                        "type": "TimeslotPicker",
                        "content": {
                            "icon": "pickup",
                            "subtitle": "Meet at the pickup address",
                            "details": "+ $5.50",
                            "dates_with_timeslots": [
                                {
                                    "header": "Wed",
                                    "date": "8 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "12:00",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Thu",
                                    "date": "9 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": false
                                        }
                                    ]
                                },
                                {
                                    "header": "Fri",
                                    "date": "10 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sat",
                                    "date": "11 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "12:00",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sun",
                                    "date": "12 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sun",
                                    "date": "13 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sun",
                                    "date": "14 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sun",
                                    "date": "15 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        }
                                    ]
                                }
                            ]
                        }
                    }]
                },
                {
                    "title": "Deliver",
                    "children": [{
                        "type": "TimeslotPicker",
                        "content": {
                            "icon": "delivery",
                            "subtitle": "Delivered at your door",
                            "details": "+ $10",
                            "dates_with_timeslots": [
                                {
                                    "header": "Wed",
                                    "date": "10 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "12:00",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Thu",
                                    "date": "11 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "11:30",
                                            "available": false
                                        },
                                        {
                                            "timeslot": "12:00",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Fri",
                                    "date": "12 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "8:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "10:00",
                                            "available": false
                                        }
                                    ]
                                },
                                {
                                    "header": "Sat",
                                    "date": "13 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "12:00",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sun",
                                    "date": "14 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sun",
                                    "date": "15 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sun",
                                    "date": "16 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        }
                                    ]
                                },
                                {
                                    "header": "Sun",
                                    "date": "17 nov.",
                                    "timeslots": [
                                        {
                                            "timeslot": "10:30",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "11:30",
                                            "available": true
                                        }
                                    ]
                                }
                            ]
                        }
                    }]
                }
            ]
        }
    }
]
""".data(using: .utf8)!

#Preview {
    return ContentView()
}
