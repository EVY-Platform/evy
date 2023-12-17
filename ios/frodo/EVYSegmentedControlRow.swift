//
//  EVYSegmentedControlRow.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct Child: Decodable {
    let title: String
    let children: [EVYRow]
}

struct EVYSegmentedControlRow: View {
    public static var JSONType = "SegmentedControl"
    private struct JSONData: Decodable {
        let children: [Child]
    }

    let children: [Child]
    @State private var selection = 0

    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.children = parsedData.children
    }

    var body: some View {
        VStack {
            Picker("Choose", selection: $selection) {
                ForEach(0..<children.count, id: \.self) { index in
                    Text(children[index].title).tag(index)
                }
            }
            .pickerStyle(.segmented)
            
            ForEach(children[selection].children.indices, id: \.self) { index in
                children[selection].children[index]
            }
        }
    }
}

#Preview {
    let json = """
    {
        "type": "SegmentedControl",
        "content": {
            "children": [
                {
                    "title": "Pickup",
                    "children": [{
                        "type": "TimeslotPicker",
                        "content": {
                            "icon": "truck.box.badge.clock",
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
                                        },
                                        {
                                            "timeslot": "11:00",
                                            "available": true
                                        },
                                        {
                                            "timeslot": "12:00",
                                            "available": true
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
                                        },
                                        {
                                            "timeslot": "12:00",
                                            "available": false
                                        },
                                        {
                                            "timeslot": "12:30",
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
                                        },
                                        {
                                            "timeslot": "13:00",
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
                                        },
                                        {
                                            "timeslot": "12:00",
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
                                        },
                                        {
                                            "timeslot": "12:00",
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
                                        },
                                        {
                                            "timeslot": "12:00",
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
                            "icon": "truck.box.badge.clock",
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
                                        },
                                        {
                                            "timeslot": "13:00",
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
                                        },
                                        {
                                            "timeslot": "12:30",
                                            "available": true
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
                                        },
                                        {
                                            "timeslot": "13:00",
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
                                        },
                                        {
                                            "timeslot": "12:00",
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
                                        },
                                        {
                                            "timeslot": "12:00",
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
                                        },
                                        {
                                            "timeslot": "12:00",
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
                                        },
                                        {
                                            "timeslot": "12:00",
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
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
