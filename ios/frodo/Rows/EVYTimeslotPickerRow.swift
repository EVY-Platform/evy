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
    let dates_with_timeslots: [EVYTimeslotDate]
}

struct EVYTimeslotPickerRow: View {
    public static var JSONType = "TimeslotPicker"
    
    private let icon: String
    private let subtitle: String
    private let details: String
    private let datesWithTimeslots: [EVYTimeslotDate]
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.icon = parsedData.icon
        self.subtitle = parsedData.subtitle
        self.details = parsedData.details
        self.datesWithTimeslots = parsedData.dates_with_timeslots
    }

    var body: some View {
        VStack{
            HStack {
                Image(icon)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: Constants.regularIconSize)
                    .padding(.leading, .zero)
                    .padding(.trailing, Constants.minorPadding)
                EVYText(subtitle)
                    .font(.regularFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                EVYText(details)
                    .font(.detailFont)
                    .frame(alignment: .trailing)
            }
            .padding()
            .padding(.top, .zero)

            EVYTimeslotPicker(timeslotDates: datesWithTimeslots)
        }
        .frame(height: 280)
    }
}

#Preview {
    let json = """
    {
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
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
