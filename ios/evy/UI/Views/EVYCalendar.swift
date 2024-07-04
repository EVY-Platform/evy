//
//  EVYCalendar.swift
//  evy
//
//  Created by Geoffroy Lesage on 2/7/2024.
//

import SwiftUI

private let spaceForFirstLabel: CGFloat = 6
private let dividerWidth: CGFloat = 0.5
private let dividerOpacity: CGFloat = 0.5
private let timeslotOpactity: CGFloat = 0.7
private let columnWidth: CGFloat = 80
private let rowHeight: CGFloat = 30

/**
 * Utils
 */
public extension Sequence {
    /// Usage:
    /// ```
    /// arr.group(by: { $0.propertyName })
    /// ```
    func group<T: Hashable>(by key: (Iterator.Element) -> T) -> [T : [Self.Element]] {
        return Dictionary(grouping: self, by: key )
    }
}

/**
 * SDUI Data types
 */
enum EVYCalendarTimeslotStyle: String, Decodable {
    case primary
    case secondary
    case none
}

public struct EVYCalendarTimeslot: Decodable {
    let x: Int
    let y: Int
    let header: String
    let start_label: String
    let end_label: String
    let style: EVYCalendarTimeslotStyle
}

/**
 * Calendar subviews
 */
struct EVYCalendarTimeslotView: View {
    let id: String
    let action: () -> Void
    
    private let fillColor: Color
    
    init(id: String,
         style: EVYCalendarTimeslotStyle,
         action: @escaping () -> Void)
    {
        self.id = id
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
                Rectangle()
                    .fill(fillColor)
                    .opacity(timeslotOpactity)
            }
        }
        .frame(height: rowHeight)
        .frame(width: columnWidth)
        .id(id)
    }
}

struct EVYCalendarTimeslotColumn: View {
    let identifier: Int
    let timeslots: [EVYCalendarTimeslotView]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(timeslots, id: \.id)  { timeslot in
                timeslot
            }
        }
        .overlay(
            Divider()
                .opacity(dividerOpacity)
                .frame(maxWidth: dividerWidth, maxHeight: .infinity)
                .background(Constants.inactiveBackground), alignment: .leading
        )
    }
}

struct EVYCalendarYAxisLabels: View {
    let labels: [String]
    
    var body: some View {
        VStack(spacing: .zero) {
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

struct EVYCalendar: View {
    private let yAxis: EVYCalendarYAxisLabels
    private let xAxis: EVYCalendarXAxisLabels
    private var columns: [EVYCalendarTimeslotColumn] = []
    
    @State private var offset = CGPoint.zero
    
    init(_ timeslots: [EVYCalendarTimeslot]) {
        var yLabels: [String] = timeslots
            .filter({ $0.x == 0})
            .map({ $0.start_label })
        yLabels.append(timeslots.last!.end_label)
        yAxis = EVYCalendarYAxisLabels(labels: yLabels)
        
        let xLabels: [String] = timeslots
            .filter({ $0.y == 0})
            .map({ String($0.header) })
        xAxis = EVYCalendarXAxisLabels(labels: xLabels)
        
        let timeslotsByX = timeslots.group(by: { $0.x })
        for x in timeslotsByX.keys.sorted() {
            let timeslotsForX = timeslotsByX[x]!.map({
                EVYCalendarTimeslotView(id: "\($0.x)_\($0.y)",
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
                    yAxis.offset(y: offset.y-spaceForFirstLabel)
                }.disabled(true)
            }
            VStack(spacing: .zero) {
                // X Axis
                ScrollView([.horizontal]) {
                    xAxis.offset(x: offset.x)
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
            "start_label": "7:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 0,
            "y": 1,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 0,
            "y": 2,
            "header": "Wed 18",
            "start_label": "8:00",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 0,
            "y": 3,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 0,
            "y": 4,
            "header": "Wed 18",
            "start_label": "9:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 0,
            "y": 5,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 0,
            "y": 6,
            "header": "Wed 18",
            "start_label": "10:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 0,
            "y": 7,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 0,
            "y": 8,
            "header": "Wed 18",
            "start_label": "11:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 0,
            "y": 9,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 0,
            "y": 10,
            "header": "Wed 18",
            "start_label": "12:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 0,
            "y": 11,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 0,
            "y": 12,
            "header": "Wed 18",
            "start_label": "13:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 0,
            "y": 14,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 0,
            "y": 15,
            "header": "Wed 18",
            "start_label": "14:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 0,
            "y": 16,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 0,
            "y": 17,
            "header": "Wed 18",
            "start_label": "15:00",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 0,
            "y": 18,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 1,
            "y": 0,
            "header": "Thu 19",
            "start_label": "7:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 1,
            "y": 1,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 1,
            "y": 2,
            "header": "Thu 19",
            "start_label": "8:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 1,
            "y": 3,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 1,
            "y": 4,
            "header": "Thu 19",
            "start_label": "9:00",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 1,
            "y": 5,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 1,
            "y": 6,
            "header": "Thu 19",
            "start_label": "10:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 1,
            "y": 7,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 1,
            "y": 8,
            "header": "Thu 19",
            "start_label": "11:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 1,
            "y": 9,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 1,
            "y": 10,
            "header": "Thu 19",
            "start_label": "12:00",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 1,
            "y": 11,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 1,
            "y": 12,
            "header": "Thu 19",
            "start_label": "13:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 1,
            "y": 14,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 1,
            "y": 15,
            "header": "Thu 19",
            "start_label": "14:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 1,
            "y": 16,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 1,
            "y": 17,
            "header": "Thu 19",
            "start_label": "15:00",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 1,
            "y": 18,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 2,
            "y": 0,
            "header": "Fri 20",
            "start_label": "7:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 2,
            "y": 1,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 2,
            "y": 2,
            "header": "Fri 20",
            "start_label": "8:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 2,
            "y": 3,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 2,
            "y": 4,
            "header": "Fri 20",
            "start_label": "9:00",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 2,
            "y": 5,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 2,
            "y": 6,
            "header": "Fri 20",
            "start_label": "10:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 2,
            "y": 7,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 2,
            "y": 8,
            "header": "Fri 20",
            "start_label": "11:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 2,
            "y": 9,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 2,
            "y": 10,
            "header": "Fri 20",
            "start_label": "12:00",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 2,
            "y": 11,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 2,
            "y": 12,
            "header": "Fri 20",
            "start_label": "13:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 2,
            "y": 14,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 2,
            "y": 15,
            "header": "Fri 20",
            "start_label": "14:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 2,
            "y": 16,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 2,
            "y": 17,
            "header": "Fri 20",
            "start_label": "15:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 2,
            "y": 18,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 3,
            "y": 0,
            "header": "Sat 21",
            "start_label": "7:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 3,
            "y": 1,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 3,
            "y": 2,
            "header": "Sat 21",
            "start_label": "8:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 3,
            "y": 3,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 3,
            "y": 4,
            "header": "Sat 21",
            "start_label": "9:00",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 3,
            "y": 5,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 3,
            "y": 6,
            "header": "Sat 21",
            "start_label": "10:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 3,
            "y": 7,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "style": "secondary"
        },{
            "x": 3,
            "y": 8,
            "header": "Sat 21",
            "start_label": "11:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 3,
            "y": 9,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "style": "primary"
        },{
            "x": 3,
            "y": 10,
            "header": "Sat 21",
            "start_label": "12:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 3,
            "y": 11,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 3,
            "y": 12,
            "header": "Sat 21",
            "start_label": "13:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 3,
            "y": 14,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 3,
            "y": 15,
            "header": "Sat 21",
            "start_label": "14:00",
            "end_label": "",
            "style": "none"
        },{
            "x": 3,
            "y": 16,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "style": "none"
        },{
            "x": 3,
            "y": 17,
            "header": "Sat 21",
            "start_label": "15:00",
            "end_label": "",
            "style": "primary"
        },{
            "x": 3,
            "y": 18,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "16:00",
            "style": "primary"
        }
    ]
    """.data(using: .utf8)!
    
    let timeslots = try! JSONDecoder().decode([EVYCalendarTimeslot].self, from: json)

    return EVYCalendar(timeslots)
}
