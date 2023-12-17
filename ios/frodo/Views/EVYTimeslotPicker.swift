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
    
    private let timeslotRowWidth: CGFloat = 70
    private let timeslotRowHeight: CGFloat = 40
    private let timeslowRectangleCornerRadius: CGFloat = 10
    private let numberOfTimeslotsPerDay: Int = 3
    
    var body: some View {
        VStack() {
            Text(timeslotDate.header).font(.detailFont)
            Text(timeslotDate.date).font(.smallFont)
            ForEach((0...(numberOfTimeslotsPerDay-1)), id: \.self) { timeslotIndex in
                if timeslotDate.timeslots.count-1 < timeslotIndex {
                    Text("-").frame(height: timeslotRowHeight)
                }
                else {
                    let t = timeslotDate.timeslots[timeslotIndex]
                    ZStack() {
                        RoundedRectangle(cornerRadius: timeslowRectangleCornerRadius)
                            .fill(t.available ?
                                  Constants.buttonColor : Constants.buttonDisabledColor)
                            .opacity(0.8)
                            .frame(height: timeslotRowHeight)
                        Text(t.timeslot)
                            .font(.smallFont)
                    }
                }
            }
        }
        .frame(width: timeslotRowWidth)
    }
}

struct EVYTimeslotPicker: View {
    @State private var selectedGroupIndex: Int = 0
    
    let timeslotDates: [EVYTimeslotDate]
    
    var body: some View {
        let groupedDays = timeslotDates.chunked(with: 4)

        VStack {
            TabView(selection:$selectedGroupIndex) {
                    ForEach(groupedDays.indices, id: \.self) { index in
                        HStack {
                            ForEach(groupedDays[index], id: \.date) { timeslotDate in
                                EVYTimeslotColumn(timeslotDate: timeslotDate)
                            }
                        }
                    }
            }
            .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
            
            HStack {
                ForEach(groupedDays.indices, id: \.self) { index in
                    Capsule()
                        .fill(Color.black.opacity(selectedGroupIndex == index ? 1 : 0.33))
                        .frame(width: 35, height: 8)
                }
            }
            .frame(alignment: .bottom)
            .padding()
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

    return EVYTimeslotPicker(timeslotDates: timeslotDates)
}
