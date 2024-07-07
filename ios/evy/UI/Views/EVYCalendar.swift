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
private let fadeDuration: CGFloat = 0.2
private let deleteButtonDuration: CGFloat = 2

/**
 * Calendar operations system
 */
public struct CalendarTimeslotIdentifier: Hashable {
    let x: Int
    let y: Int
    let datasourceIndex: Int
}

public enum CalendarOperation: Hashable {
    case extend(identifier: CalendarTimeslotIdentifier)
    case delete(tapped: Bool)
    case selectRow(y: Int)
    case selectColumn(x: Int)
}

struct CalendarOperationKey: EnvironmentKey {
    static let defaultValue: (CalendarOperation) -> Void = { _  in }
}

extension EnvironmentValues {
    var operate: (CalendarOperation) -> Void {
        get { self[CalendarOperationKey.self] }
        set { self[CalendarOperationKey.self] = newValue }
    }
}

/**
 * Calendar event system
 */
extension Notification.Name {
    static let calendarTimeslotSelect = Notification.Name("EVYCalendarTimeslotSelect")
    static let calendarTimeslotDeselect = Notification.Name("EVYCalendarTimeslotDeselect")
}

/**
 * SDUI Data types
 */
public struct EVYCalendarTimeslotData: Decodable {
    let x: Int
    let y: Int
    let header: String
    let start_label: String
    let end_label: String
    let selected: Bool
}

/**
 * Util structs
 */
extension CGPoint : Hashable {
  public func hash(into hasher: inout Hasher) {
    hasher.combine(x)
    hasher.combine(y)
  }
}
public struct EVYCalendarTimeslot: Hashable {
    let x: Int
    let y: Int
    let datasourceIndex: Int
    var isSelected: Bool
    var hasSecondary: Bool
}

/**
 * Calendar subviews
 */
struct EVYCalendarTimeslotView: View {
    @Environment(\.operate) private var operate
    
    let id: CalendarTimeslotIdentifier
    @State public var selected: Bool
    public var hasSecondary: Bool
    
    public func performAction() -> Void {
        if !selected {
            withAnimation(.easeOut(duration: fadeDuration), {
                selected = true
            })
        }
        operate(CalendarOperation.extend(identifier: id))
    }
    
    var body: some View {
        Button(action: performAction) {
            VStack(spacing: .zero) {
                Rectangle()
                    .fill(selected ? Constants.buttonColor :
                            (hasSecondary ? Constants.inactiveBackground : .clear)
                    )
                    .opacity(timeslotOpactity)
            }
            .foregroundColor(.clear)
        }
        .frame(height: rowHeight)
        .frame(width: columnWidth)
        .onReceive(NotificationCenter.default.publisher(
            for: Notification.Name.calendarTimeslotDeselect)
        ) { notif in
            if let point = notif.object as? CGPoint,
               Int(point.x) == id.x,
               Int(point.y) == id.y
            {
                selected = false
            }
        }
        .onReceive(NotificationCenter.default.publisher(
            for: Notification.Name.calendarTimeslotSelect)
        ) { notif in
            if let point = notif.object as? CGPoint,
               Int(point.x) == id.x,
               Int(point.y) == id.y
            {
                selected = true
            }
        }
        .id(id)
    }
}

struct EVYCalendarDeleteButton: View {
    @Environment(\.operate) private var operate
    @State var alreadyTapped: Bool = false

    var body: some View {
        Button(action: {
            alreadyTapped = true
            operate(CalendarOperation.delete(tapped: true))
        }) {
            Circle()
                .fill(.white)
                .strokeBorder(Constants.fieldBorderColor,
                              lineWidth: Constants.borderWidth)
                .overlay(EVYTextView("::trash::", style: .button))
        }
        .frame(height: columnWidth/2)
        .frame(width: columnWidth/2)
        .onAppear {
            alreadyTapped = false
            DispatchQueue.main.asyncAfter(deadline: .now() + deleteButtonDuration) {
                if !alreadyTapped {
                    operate(CalendarOperation.delete(tapped: false))
                }
            }
        }
        .padding()
    }
}

struct EVYCalendarContentView: View {
    let numberOfDays: Int
    let numberOfTimeslotsPerDay: Int
    let timeslots: [[EVYCalendarTimeslot]]
    
    var body: some View {
        HStack(spacing: .zero) {
            ForEach(timeslots.indices, id: \.self) { x in
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(timeslots[x].indices, id: \.self) { y in
                        let timeslot = timeslots[x][y]
                        let id = CalendarTimeslotIdentifier(x: x, y: y,
                                                            datasourceIndex: timeslot.datasourceIndex)
                        EVYCalendarTimeslotView(id: id,
                                                selected: timeslot.isSelected,
                                                hasSecondary: timeslot.hasSecondary)
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
    }
}

struct EVYCalendarYAxisView: View {
    @Environment(\.operate) private var operate
    
    let labels: [String]
    @Binding var offset: CGPoint
    
    var body: some View {
        VStack(spacing: .zero) {
            // empty corner
            Color.clear.frame(width: .zero, height: rowHeight-spaceForFirstLabel)
            ScrollView([.vertical]) {
                // Offset based on scroll position but also add to center correctly
                VStack(spacing: .zero) {
                    ForEach(labels.indices, id: \.self)  { y in
                        Button(action: {
                            operate(CalendarOperation.selectRow(y: y))
                        }, label: {
                            let label = labels[y].count > 0 ? labels[y] : "-"
                            EVYTextView(label, style: .info)
                        })
                        .frame(height: rowHeight)
                        .frame(width: columnWidth)
                    }
                }.offset(y: offset.y-spaceForFirstLabel)
            }.scrollDisabled(true)
        }
    }
}

struct EVYCalendarXAxisView: View {
    @Environment(\.operate) private var operate
    
    let labels: [String]
    @Binding var offset: CGPoint
    
    var body: some View {
        ScrollView([.horizontal]) {
            HStack(spacing: .zero) {
                ForEach(labels.indices, id: \.self)  { x in
                    Button(action: {
                        operate(CalendarOperation.selectColumn(x: x))
                    }, label: {
                        EVYTextView(labels[x], style: .info)
                    })
                    .frame(height: rowHeight)
                    .frame(width: columnWidth)
                }
            }.offset(x: offset.x)
        }.scrollDisabled(true)
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
    private var yLabels: [String] = []
    private var xLabels: [String] = []
    @State private var timeslots: [[EVYCalendarTimeslot]]
    
    @State private var offset = CGPoint.zero
    @State private var showDeleteButton: Bool = false
    @State private var lastButtonKey: (Int, Int)?
    
    init(primary: String, secondary: String) {
        var primaryTimeslots: [EVYCalendarTimeslotData] = []
        var secondaryTimeslots: [EVYCalendarTimeslotData] = []
        
        do {
            let timeslotsJSON = try EVY.getDataFromText(primary)
            primaryTimeslots = try JSONDecoder().decode(
                [EVYCalendarTimeslotData].self,from: timeslotsJSON.toString().data(using: .utf8)!
            )
            xLabels = primaryTimeslots
                .filter({ $0.y == 0})
                .map({ String($0.header) })
            yLabels = primaryTimeslots
                .filter({ $0.x == 0})
                .map({ $0.start_label })
            yLabels.append(primaryTimeslots.last!.end_label)
        } catch {}
        
        do {
            let timeslotsJSON = try EVY.getDataFromText(secondary)
            secondaryTimeslots = try JSONDecoder().decode(
                [EVYCalendarTimeslotData].self, from: timeslotsJSON.toString().data(using: .utf8)!
            )
        } catch {}
        
        let numberOfTimeslotsPerDay = yLabels.count-1
        let numberOfDays = xLabels.count
        var xValues: [[EVYCalendarTimeslot]] = []
        for x in (0..<numberOfDays) {
            var yValues: [EVYCalendarTimeslot] = []
            for y in (0..<numberOfTimeslotsPerDay) {
                let relevantIndex = y+(x*numberOfTimeslotsPerDay)
                let primarySelected = primaryTimeslots[relevantIndex].selected
                let secondarySelected = secondaryTimeslots[relevantIndex].selected
                let timeslot = EVYCalendarTimeslot(x: x, y: y,
                                                   datasourceIndex: relevantIndex,
                                                   isSelected: primarySelected,
                                                   hasSecondary: secondarySelected)
                yValues.append(timeslot)
            }
            xValues.append(yValues)
        }
        self.timeslots = xValues
    }
    
    private func handleOperation(_ operation: CalendarOperation) {
        switch operation {
        case .extend(let identifier):
            lastButtonKey = (identifier.x, identifier.y)
            withAnimation(.easeOut(duration: fadeDuration), {
                showDeleteButton = true
            })
            // find the next empty slot on the day
            var index = identifier.y
            while (index < yLabels.count-1) {
                if timeslots[identifier.x][index].isSelected {
                    index += 1
                } else {
                    timeslots[identifier.x][index].isSelected = true
                    break
                }
            }
            NotificationCenter.default.post(
                name: Notification.Name.calendarTimeslotSelect,
                object: CGPoint(x:identifier.x, y:index)
            )
        case .delete(let tapped):
            withAnimation(.easeOut(duration: fadeDuration), {
                showDeleteButton = false
            })
            
            if tapped, lastButtonKey != nil {
                let x = lastButtonKey!.0
                let y = lastButtonKey!.1
    
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotDeselect,
                    object: CGPoint(x:x, y:y)
                )
            }
            
        case .selectRow(let y):
            timeslots.forEach({ column in
                let x = column.first!.x
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotSelect,
                    object: CGPoint(x:x, y:timeslots[x][y].y)
                )
            })
        
        case .selectColumn(let x):
            timeslots[x].forEach({ column in
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotSelect,
                    object: CGPoint(x:x, y:column.y)
                )
            })
        }
    }
    
    var body: some View {
        HStack(spacing: .zero) {
            EVYCalendarYAxisView(labels: yLabels, offset: $offset)
            VStack(spacing: .zero) {
                EVYCalendarXAxisView(labels: xLabels, offset: $offset)
                ScrollViewReader { _ in
                    ScrollView([.vertical, .horizontal]) {
                        EVYCalendarContentView(numberOfDays: xLabels.count,
                                               numberOfTimeslotsPerDay: yLabels.count-1,
                                               timeslots: timeslots)
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
        .overlay(showDeleteButton ? EVYCalendarDeleteButton() : nil, alignment: .bottom)
        .environment(\.operate) { calendarOperation in
            handleOperation(calendarOperation)
        }
    }
}

#Preview {
    let pickup = DataConstants.pickupTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "pickupTimeslots", data: pickup)
    
    let delivery = DataConstants.deliveryTimeslots.data(using: .utf8)!
    try! EVY.data.create(key: "deliveryTimeslots", data: delivery)

    return EVYCalendar(primary: "pickupTimeslots", secondary: "deliveryTimeslots")
}
