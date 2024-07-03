//
//  EVYCalendar.swift
//  evy
//
//  Created by Geoffroy Lesage on 2/7/2024.
//

import SwiftUI

private let spaceForFirstLabel: CGFloat = 8
private let dividerWidth: CGFloat = 0.5
private let dividerOpacity: CGFloat = 0.5
private let timeslotOpactity: CGFloat = 0.7
private let columnWidth: CGFloat = 80
private let rowHeight: CGFloat = 30

public extension Sequence {
    /// groupBy
    ///
    /// Usage:
    /// ```
    /// arr.group(by: { $0.propertyName })
    /// ```
    func group<T: Hashable>(by key: (Iterator.Element) -> T) -> [T : [Self.Element]] {
        return Dictionary(grouping: self, by: key )
    }
    
    /// groupBy
    ///
    /// Usage:
    /// ```
    /// arr.group(by: { $0.propertyName }, values: \.propertyName2 )
    /// ```
    func group<T: Hashable>(by key: (Iterator.Element) -> T, values keyPath: KeyPath<Element, T> ) -> [T : [T]] {
        return Dictionary(grouping: self, by: key )
            .valuesMapped { $0.map{ $0[keyPath: keyPath] } }
    }
}

public extension Dictionary {
    func valuesMapped<T>(_ transform: (Value) -> T) -> [Key: T] {
        var newDict = [Key: T]()
        for (key, value) in self {
            newDict[key] = transform(value)
        }
        return newDict
    }
}

struct EVYCalendarTimeslotView: View {
    let identifier: String
    let start: Double
    let end: Double
    let action: () -> Void
    
    private let fillColor: Color
    
    init(identifier: String,
         start: Double,
         end: Double,
         style: EVYCalendarTimeslotStyle,
         action: @escaping () -> Void)
    {
        self.identifier = identifier
        self.start = start
        self.end = end
        self.action = action
        
        switch style {
        case .primary:
            fillColor = Constants.buttonColor
        case .secondary:
            fillColor = Constants.inactiveBackground
        default:
            fillColor = .clear
        }
    }
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: .zero) {
                Divider()
                    .background(Constants.inactiveBackground)
                    .opacity(dividerOpacity)
                Rectangle()
                    .fill(fillColor)
                    .opacity(timeslotOpactity)
            }
        }
        .frame(height: rowHeight)
        .frame(width: columnWidth)
        .id(identifier)
    }
}

struct EVYCalendarTimeslotColumn: View {
    let identifier: Int
    let timeslots: [EVYCalendarTimeslotView]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(timeslots, id: \.start)  { timeslot in
                timeslot
            }
        }.overlay( Divider()
            .opacity(dividerOpacity)
            .frame(maxWidth: dividerWidth, maxHeight: .infinity)
            .background(Constants.inactiveBackground), alignment: .leading )
    }
}

struct EVYCalendarYAxisLabels: View {
    let labels: [String]
    
    var body: some View {
        VStack(spacing: .zero) {
            EVYTextView("").padding(Constants.minPading)
            ForEach(labels, id: \.self)  { label in
                EVYTextView(label, style: .info)
                    .frame(height: rowHeight)
                    .frame(width: columnWidth)
            }
        }
    }
}

struct EVYCalendarXAxisLabels: View {
    let labels: [String]
    
    var body: some View {
        HStack(spacing: .zero) {
            EVYTextView("").padding(Constants.minPading)
            ForEach(labels, id: \.self)  { label in
                EVYTextView(label, style: .info)
                    .frame(height: rowHeight)
                    .frame(width: columnWidth)
            }
        }
    }
}

struct ViewOffsetKey: PreferenceKey {
    typealias Value = CGPoint
    static var defaultValue = CGPoint.zero
    static func reduce(value: inout Value, nextValue: () -> Value) {
        value.x += nextValue().x
        value.y += nextValue().y
    }
}

enum EVYCalendarTimeslotStyle: String, Decodable {
    case primary
    case secondary
    case none
}

public struct EVYCalendarTimeslot: Decodable, Hashable {
    let x: Int
    let y: Int
    let header: String
    let label: String
    let start: Double
    let end: Double
    let style: EVYCalendarTimeslotStyle
    
    public func hash(into hasher: inout Hasher) {
        hasher.combine(UUID().uuidString)
    }
}



struct EVYCalendar: View {
    private let numberOfTimeslotsPerDay: Int
    private let yAxis: EVYCalendarYAxisLabels
    private let xAxis: EVYCalendarXAxisLabels
    private var columns: [EVYCalendarTimeslotColumn] = []
    
    @State private var offset = CGPoint.zero
    
    init(_ timeslots: [EVYCalendarTimeslot]) {
        let yLabels: [String] = timeslots
            .filter({ $0.x == 0})
            .map({ $0.label })
        yAxis = EVYCalendarYAxisLabels(labels: yLabels)
        numberOfTimeslotsPerDay = yLabels.count
        
        let xLabels: [String] = timeslots
            .group(by: { $0.header })
            .map({ String($0.key) })
        xAxis = EVYCalendarXAxisLabels(labels: xLabels)
        
        let timeslotsByX = timeslots.group(by: { $0.x })
        for x in timeslotsByX.keys.sorted() {
            let timeslotsForX = timeslotsByX[x]!.map({
                EVYCalendarTimeslotView(identifier: "\($0.x)_\($0.y)",
                                        start: $0.start,
                                        end: $0.end,
                                        style: $0.style,
                                        action: { print("test") })
            })
            self.columns.append(
                EVYCalendarTimeslotColumn(identifier: x, timeslots: timeslotsForX)
            )
        }
    }
    
    var body: some View {
        HStack(spacing: .zero) {
            VStack(spacing: .zero) {
                // empty corner
                Color.clear.frame(width: .zero, height: rowHeight-spaceForFirstLabel)
                
                // Y Axis
                ScrollView([.vertical]) {
                    // Offset based on scroll position but also add to center correctly
                    yAxis.offset(y: offset.y-(columnWidth*0.5)+spaceForFirstLabel)
                }.disabled(true)
            }
            VStack(spacing: .zero) {
                // X Axis
                ScrollView([.horizontal]) {
                    // Offset based on scroll position but also add to center correctly
                    xAxis.offset(x: offset.x-(rowHeight*0.2))
                }.disabled(true)
                
                // Content
                ScrollViewReader { cellProxy in
                    ScrollView([.vertical, .horizontal]) {
                        HStack(alignment: .top, spacing: 0) {
                            ForEach(columns, id: \.identifier) { column in
                                column
                            }
                        }
                        .background( GeometryReader { geo in
                            Color.clear
                                .preference(key: ViewOffsetKey.self,
                                            value: geo.frame(in: .named("scroll")).origin)
                        })
                        .onPreferenceChange(ViewOffsetKey.self) { value in
                            offset = value
                        }
                        .onAppear {
                            // Scroll on open to middle of day on the calendar
                            let y = Float(numberOfTimeslotsPerDay)*0.6
                            cellProxy.scrollTo("0_\(Int(y))")
                        }
                    }
                }
                .coordinateSpace(name: "scroll")
            }
        }
    }
}

#Preview {
    let json = """
    [
        {
            "x": 0,
            "y": 0,
            "header": "Wed 18",
            "label": "7:00",
            "start": 1720012483,
            "end": 1720014283,
            "style": "primary"
        },{
            "x": 0,
            "y": 1,
            "header": "Wed 18",
            "label": "",
            "start": 1720014283,
            "end": 1720016083,
            "style": "primary"
        },
        {
            "x": 0,
            "y": 2,
            "header": "Wed 18",
            "label": "8:00",
            "start": 1720016083,
            "end": 1720017883,
            "style": "secondary"
        },{
            "x": 0,
            "y": 3,
            "header": "Wed 18",
            "label": "",
            "start": 1720017883,
            "end": 1720019683,
            "style": "secondary"
        },{
            "x": 0,
            "y": 4,
            "header": "Wed 18",
            "label": "9:00",
            "start": 1720019683,
            "end": 1720021483,
            "style": "none"
        },{
            "x": 0,
            "y": 5,
            "header": "Wed 18",
            "label": "",
            "start": 1720012482,
            "end": 1720023283,
            "style": "none"
        },{
            "x": 0,
            "y": 6,
            "header": "Wed 18",
            "label": "10:00",
            "start": 1720012482,
            "end": 1720014289,
            "style": "none"
        },{
            "x": 0,
            "y": 7,
            "header": "Wed 18",
            "label": "",
            "start": 1720014282,
            "end": 1720016084,
            "style": "none"
        },
        {
            "x": 0,
            "y": 8,
            "header": "Wed 18",
            "label": "11:00",
            "start": 1720016082,
            "end": 1720017884,
            "style": "none"
        },{
            "x": 0,
            "y": 9,
            "header": "Wed 18",
            "label": "",
            "start": 1720017882,
            "end": 1720019684,
            "style": "none"
        },{
            "x": 0,
            "y": 10,
            "header": "Wed 18",
            "label": "12:00",
            "start": 1720019682,
            "end": 1720021483,
            "style": "none"
        },{
            "x": 0,
            "y": 11,
            "header": "Wed 18",
            "label": "",
            "start": 1720012484,
            "end": 1720023283,
            "style": "secondary"
        },{
            "x": 0,
            "y": 12,
            "header": "Wed 18",
            "label": "13:00",
            "start": 1720212484,
            "end": 1720014280,
            "style": "primary"
        },{
            "x": 0,
            "y": 14,
            "header": "Wed 18",
            "label": "",
            "start": 1720014284,
            "end": 1720016092,
            "style": "primary"
        },
        {
            "x": 0,
            "y": 15,
            "header": "Wed 18",
            "label": "14:00",
            "start": 1720026084,
            "end": 1720017885,
            "style": "primary"
        },{
            "x": 0,
            "y": 16,
            "header": "Wed 18",
            "label": "",
            "start": 1720017984,
            "end": 1720019685,
            "style": "primary"
        },{
            "x": 0,
            "y": 17,
            "header": "Wed 18",
            "label": "15:00",
            "start": 1720029683,
            "end": 1720021483,
            "style": "secondary"
        },{
            "x": 0,
            "y": 18,
            "header": "Wed 18",
            "label": "",
            "start": 1720012485,
            "end": 1720023283,
            "style": "secondary"
        },{
            "x": 1,
            "y": 0,
            "header": "Thu 19",
            "label": "7:00",
            "start": 1720012480,
            "end": 1720014288,
            "style": "none"
        },{
            "x": 1,
            "y": 1,
            "header": "Thu 19",
            "label": "",
            "start": 1720014288,
            "end": 1720016085,
            "style": "none"
        },
        {
            "x": 1,
            "y": 2,
            "header": "Thu 19",
            "label": "8:00",
            "start": 1720016086,
            "end": 1720017886,
            "style": "primary"
        },{
            "x": 1,
            "y": 3,
            "header": "Thu 19",
            "label": "",
            "start": 1720017887,
            "end": 1720019686,
            "style": "primary"
        },{
            "x": 1,
            "y": 4,
            "header": "Thu 19",
            "label": "9:00",
            "start": 1720019687,
            "end": 1720021483,
            "style": "secondary"
        },{
            "x": 1,
            "y": 5,
            "header": "Thu 19",
            "label": "",
            "start": 1720012486,
            "end": 1720023283,
            "style": "secondary"
        },{
            "x": 1,
            "y": 6,
            "header": "Thu 19",
            "label": "10:00",
            "start": 1720012487,
            "end": 1720014287,
            "style": "none"
        },{
            "x": 1,
            "y": 7,
            "header": "Thu 19",
            "label": "",
            "start": 1721014284,
            "end": 1720016087,
            "style": "none"
        },
        {
            "x": 1,
            "y": 8,
            "header": "Thu 19",
            "label": "11:00",
            "start": 1720036084,
            "end": 1720012887,
            "style": "primary"
        },{
            "x": 1,
            "y": 9,
            "header": "Thu 19",
            "label": "",
            "start": 1720017684,
            "end": 1720019688,
            "style": "primary"
        },{
            "x": 1,
            "y": 10,
            "header": "Thu 19",
            "label": "12:00",
            "start": 1720011684,
            "end": 1720021483,
            "style": "secondary"
        },{
            "x": 1,
            "y": 11,
            "header": "Thu 19",
            "label": "",
            "start": 1720012488,
            "end": 1720023283,
            "style": "secondary"
        },{
            "x": 1,
            "y": 12,
            "header": "Thu 19",
            "label": "13:00",
            "start": 1720012489,
            "end": 1720014286,
            "style": "none"
        },{
            "x": 1,
            "y": 14,
            "header": "Thu 19",
            "label": "",
            "start": 1720014285,
            "end": 1720016088,
            "style": "none"
        },
        {
            "x": 1,
            "y": 15,
            "header": "Thu 19",
            "label": "14:00",
            "start": 1720026085,
            "end": 1720017888,
            "style": "primary"
        },{
            "x": 1,
            "y": 16,
            "header": "Thu 19",
            "label": "",
            "start": 1722017885,
            "end": 1720019689,
            "style": "primary"
        },{
            "x": 1,
            "y": 17,
            "header": "Thu 19",
            "label": "15:00",
            "start": 1710019685,
            "end": 1720021483,
            "style": "secondary"
        },{
            "x": 1,
            "y": 18,
            "header": "Thu 19",
            "label": "",
            "start": 1720012490,
            "end": 1720023283,
            "style": "secondary"
        },{
            "x": 2,
            "y": 0,
            "header": "Fri 20",
            "label": "7:00",
            "start": 1720012481,
            "end": 1720014280,
            "style": "none"
        },{
            "x": 2,
            "y": 1,
            "header": "Fri 20",
            "label": "",
            "start": 1720014281,
            "end": 1720016089,
            "style": "none"
        },
        {
            "x": 2,
            "y": 2,
            "header": "Fri 20",
            "label": "8:00",
            "start": 1720016081,
            "end": 1720017889,
            "style": "none"
        },{
            "x": 2,
            "y": 3,
            "header": "Fri 20",
            "label": "",
            "start": 1720017881,
            "end": 1720019690,
            "style": "none"
        },{
            "x": 2,
            "y": 4,
            "header": "Fri 20",
            "label": "9:00",
            "start": 1720019681,
            "end": 1720021483,
            "style": "secondary"
        },{
            "x": 2,
            "y": 5,
            "header": "Fri 20",
            "label": "",
            "start": 1710012481,
            "end": 1720023283,
            "style": "secondary"
        },{
            "x": 2,
            "y": 6,
            "header": "Fri 20",
            "label": "10:00",
            "start": 1420012481,
            "end": 1720014224,
            "style": "primary"
        },{
            "x": 2,
            "y": 7,
            "header": "Fri 20",
            "label": "",
            "start": 1720114284,
            "end": 1720016090,
            "style": "primary"
        },
        {
            "x": 2,
            "y": 8,
            "header": "Fri 20",
            "label": "11:00",
            "start": 1220016081,
            "end": 1720017890,
            "style": "primary"
        },{
            "x": 2,
            "y": 9,
            "header": "Fri 20",
            "label": "",
            "start": 1220017881,
            "end": 1720019691,
            "style": "primary"
        },{
            "x": 2,
            "y": 10,
            "header": "Fri 20",
            "label": "12:00",
            "start": 1120019681,
            "end": 1720021483,
            "style": "secondary"
        },{
            "x": 2,
            "y": 11,
            "header": "Fri 20",
            "label": "",
            "start": 1320012481,
            "end": 1720023283,
            "style": "secondary"
        },{
            "x": 2,
            "y": 12,
            "header": "Fri 20",
            "label": "13:00",
            "start": 1220012481,
            "end": 1720014263,
            "style": "none"
        },{
            "x": 2,
            "y": 14,
            "header": "Fri 20",
            "label": "",
            "start": 1120014286,
            "end": 1720016091,
            "style": "primary"
        },
        {
            "x": 2,
            "y": 15,
            "header": "Fri 20",
            "label": "14:00",
            "start": 1320016081,
            "end": 1720017891,
            "style": "primary"
        },{
            "x": 2,
            "y": 16,
            "header": "Fri 20",
            "label": "",
            "start": 1320017881,
            "end": 1720019692,
            "style": "secondary"
        },{
            "x": 2,
            "y": 17,
            "header": "Fri 20",
            "label": "15:00",
            "start": 1320019681,
            "end": 1720021483,
            "style": "primary"
        },{
            "x": 2,
            "y": 18,
            "header": "Fri 20",
            "label": "",
            "start": 1120012481,
            "end": 1720023283,
            "style": "none"
        }
    ]
    """.data(using: .utf8)!
    
    let timeslots = try! JSONDecoder().decode([EVYCalendarTimeslot].self, from: json)

    return EVYCalendar(timeslots)
}
