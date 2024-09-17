//
//  EVYTimeslotPicker.swift
//  EVY
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import SwiftUI

public struct EVYTimeslot: Decodable, Hashable {
    let timeslot: String
    let available: Bool
    
    public func hash(into hasher: inout Hasher) {
        hasher.combine(UUID().uuidString)
    }
}
public struct EVYTimeslotDate: Decodable {
    let header: String
    let date: String
    let timeslots: [EVYTimeslot]
}

struct EVYTimeslotColumn: View {
    let timeslotDate: EVYTimeslotDate
    let numberOfTimeslotsPerDay: Int
    let action: () -> Void
    
    var body: some View {
        VStack {
            EVYTextView(timeslotDate.header)
            EVYTextView(timeslotDate.date)
            ForEach((0...(numberOfTimeslotsPerDay-1)), id: \.self) { timeslotIndex in
                if timeslotDate.timeslots.count-1 < timeslotIndex {
                    EVYInlineButton(value: "-", style: .clear, action: action)
                }
                else {
                    let t = timeslotDate.timeslots[timeslotIndex]
                    EVYInlineButton(value: t.timeslot,
                                    style: t.available ? .primary : .secondary,
                                    action: action)
                }
            }
        }
    }
}

struct EVYTimeslotPicker: View {
    @State private var selectedGroupIndex: Int = 0
    private var numberOfTimeslotsPerDay: Int = 0
    
    let timeslotDates: [EVYTimeslotDate]
    
    init(_ timeslotDates: [EVYTimeslotDate]) {
        self.timeslotDates = timeslotDates
        for index in 0...timeslotDates.count-1 {
            if timeslotDates[index].timeslots.count > self.numberOfTimeslotsPerDay {
                self.numberOfTimeslotsPerDay = timeslotDates[index].timeslots.count
            }
        }
    }
    
    var body: some View {
        let groupedDays = timeslotDates.chunked(with: 4)

        VStack {
            TabView(selection:$selectedGroupIndex) {
                    ForEach(groupedDays.indices, id: \.self) { index in
                        HStack {
                            ForEach(groupedDays[index], id: \.date) { timeslotDate in
                                EVYTimeslotColumn(timeslotDate: timeslotDate,
                                                  numberOfTimeslotsPerDay: numberOfTimeslotsPerDay,
                                                  action: { print("test") })
                                .padding(.horizontal, Constants.padding)
                            }
                        }
                    }
            }
            .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
            
            EVYCarouselIndicator(indices: (0...groupedDays.count-1),
                                 selectionIndex: selectedGroupIndex,
                                 color: .black)
        }
    }
}

#Preview {
    let json = """
    [
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
        }
    ]
    """.data(using: .utf8)!
    
    let timeslotDates = try! JSONDecoder().decode([EVYTimeslotDate].self, from: json)

    return EVYTimeslotPicker(timeslotDates)
}
