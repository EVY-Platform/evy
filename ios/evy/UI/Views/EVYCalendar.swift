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
private let undoButtonDuration: CGFloat = 2

/**
 * Calendar operations system
 */
struct CalendarTimeslotIdentifier: Hashable {
    let x: Int
    let y: Int
    let datasourceIndex: Int
}

enum CalendarSelectionMode: Hashable {
    case enter
    case exit
}

enum CalendarOperation: Hashable {
    case extend(identifier: CalendarTimeslotIdentifier)
    case delete(identifier: CalendarTimeslotIdentifier)
    case undo(tapped: Bool)
    case selection(mode: CalendarSelectionMode)
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
 * Util views
 */
struct WiggleAnimation<Content: View>: View {
    var content: Content
    @Binding var animate: Bool
    @State private var wave = true

    var body: some View {
        content
        .id(animate)
        .onChange(of: animate) { oldValue, newValue in
            if newValue {
                let baseAnimation = Animation.linear(duration: 0.15)
                withAnimation(baseAnimation.repeatForever(autoreverses: true)) {
                    wave.toggle()
                }
            }
        }
        .rotationEffect(.degrees(animate ? (wave ? 2.5 : -2.5) : 0.0),
                        anchor: .center)
    }

    init(animate: Binding<Bool>,
         @ViewBuilder content: @escaping () -> Content) {
        self.content = content()
        self._animate = animate
    }
}

/**
 * Calendar event system
 */
extension Notification.Name {
    static let calendarTimeslotSelect = Notification.Name("EVYCalendarTimeslotSelect")
    static let calendarTimeslotDeselect = Notification.Name("EVYCalendarTimeslotDeselect")
    static let calendarTimeslotPrepare = Notification.Name("calendarTimeslotPrepare")
    static let calendarTimeslotUnprepare = Notification.Name("calendarTimeslotUnprepare")
}

/**
 * SDUI Data types
 */
struct EVYCalendarTimeslotData: Decodable {
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
struct EVYCalendarTimeslot: Hashable {
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
    @State private var inDeleteMode: Bool = false
    
    public func performAction(hold: Bool) -> Void {
        if !inDeleteMode && hold {
            operate(CalendarOperation.selection(mode: .enter))
        } else if inDeleteMode && selected {
            withAnimation(.easeOut(duration: fadeDuration), {
                selected = false
            })
            operate(CalendarOperation.delete(identifier: id))
        } else if !inDeleteMode {
            if !selected {
                withAnimation(.easeOut(duration: fadeDuration), {
                    selected = true
                })
            }
            operate(CalendarOperation.extend(identifier: id))
        }
    }
    
    var body: some View {
        WiggleAnimation(animate: $inDeleteMode, content: {
            Button(action: {}) {
                VStack(spacing: .zero) {
                    Rectangle()
                        .fill(selected ? Constants.buttonColor :
                                (hasSecondary ? Constants.inactiveBackground : .clear)
                        )
                        .opacity(timeslotOpactity)
                }
                .foregroundColor(.clear)
            }
            .simultaneousGesture(
                LongPressGesture()
                    .onEnded { _ in
                        performAction(hold: true)
                    }
            )
            .highPriorityGesture(
                TapGesture()
                    .onEnded { _ in
                        performAction(hold: false)
                    }
            )
        })
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
        .onReceive(NotificationCenter.default.publisher(
            for: Notification.Name.calendarTimeslotPrepare)
        ) { _ in
            inDeleteMode = true
        }
        .onReceive(NotificationCenter.default.publisher(
            for: Notification.Name.calendarTimeslotUnprepare)
        ) { notif in
            inDeleteMode = false
        }
        .id(id)
    }
}

enum EVYCalendarButtonMode: Hashable {
    case undo
    case done
}

struct EVYCalendarButton: View {
    @Environment(\.operate) private var operate
    let mode: EVYCalendarButtonMode

    var body: some View {
        Button(action: {
            if mode == .undo {
                operate(CalendarOperation.undo(tapped: true))
            } else {
                operate(CalendarOperation.selection(mode: .exit))
            }
                
        }) {
            Circle()
                .fill(.white)
                .strokeBorder(Constants.fieldBorderColor,
                              lineWidth: Constants.borderWidth)
                .overlay(EVYTextView(mode == .undo ? "::arrow.uturn.backward::" : "::checkmark::",
                                     style: .button))
        }
        .frame(height: columnWidth/2)
        .frame(width: columnWidth/2)
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
    @State private var inUndoMode: Bool = false
    @State private var inDeleteMode: Bool = false
    
    @State private var lifoQueue: [[CalendarTimeslotIdentifier]] = []
    
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
    
    private func nextAvailableSlot(x: Int, y: Int, max: Int) -> Int? {
        var index = y
        while (index < max) {
            if timeslots[x][index].isSelected {
                index += 1
            } else {
                return index
            }
        }
        return nil
    }
    
    private func lastBlockSlot(x: Int, y: Int, max: Int) -> Int {
        var index = y
        while (index < max) {
            if timeslots[x][index].isSelected {
                index += 1
            } else {
                return index-1
            }
        }
        return max
    }
    
    private func firstBlockSlot(x: Int, y: Int) -> Int {
        var index = y
        while (index > 0) {
            if timeslots[x][index].isSelected {
                index -= 1
            } else {
                return index+1
            }
        }
        return y
    }
    
    private func handleOperation(_ operation: CalendarOperation) {
        switch operation {
        case .extend(let identifier):
            withAnimation(.easeOut(duration: fadeDuration), {
                inDeleteMode = false
                inUndoMode = true
            })
            let x = identifier.x
            let slotY: Int? = nextAvailableSlot(x: x, y: identifier.y,
                                                max: yLabels.count-1)
            if slotY != nil {
                timeslots[x][slotY!].isSelected = true
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotSelect,
                    object: CGPoint(x:x, y:slotY!)
                )
                
                let datasourceIndex = timeslots[x][slotY!].datasourceIndex
                lifoQueue.append([CalendarTimeslotIdentifier(x: x,
                                                             y: slotY!,
                                                             datasourceIndex: datasourceIndex)])
                let props = "{pickupTimeslots[\(datasourceIndex)}"
                try! EVY.updateValue("true", at: props)
            }
            
        case .delete(let identifier):
            let x = identifier.x
            let y = identifier.y
            
            timeslots[x][y].isSelected = false
            
            NotificationCenter.default.post(
                name: Notification.Name.calendarTimeslotDeselect,
                object: CGPoint(x:x, y:y)
            )
            
            let props = "{pickupTimeslots[\(identifier.datasourceIndex)}"
            try! EVY.updateValue("false", at: props)
            
        case .undo(let tapped):
            let lastSlots = lifoQueue.popLast()!
            lastSlots.forEach({ lastSlot in
                timeslots[lastSlot.x][lastSlot.y].isSelected = false
                
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotDeselect,
                    object: CGPoint(x:lastSlot.x, y:lastSlot.y)
                )
                
                let props = "{pickupTimeslots[\(lastSlot.datasourceIndex)}"
                try! EVY.updateValue("false", at: props)
            })
            
        case .selection(let mode):
            if mode == .enter {
                lifoQueue.removeAll()
                withAnimation(.easeOut(duration: fadeDuration), {
                    inUndoMode = false
                    inDeleteMode = true
                })
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotPrepare,
                    object: nil)
            } else {
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotUnprepare,
                    object: nil)
                withAnimation(.easeOut(duration: fadeDuration), {
                    inDeleteMode = false
                })
            }
            
        case .selectRow(let y):
            var slots: [CalendarTimeslotIdentifier] = []
            timeslots.forEach({ column in
                let x = column.first!.x
                let slot = timeslots[x][y]
                if slot.isSelected != inDeleteMode {
                    return
                }
                timeslots[slot.x][slot.y].isSelected = !inDeleteMode
                if !inDeleteMode {
                    slots.append(
                        CalendarTimeslotIdentifier(x: x, y: y,
                                                   datasourceIndex: slot.datasourceIndex)
                    )
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotSelect,
                        object: CGPoint(x:x, y:y)
                    )
                } else {
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotDeselect,
                        object: CGPoint(x:x, y:y)
                    )
                }
                let props = "{pickupTimeslots[\(slot.datasourceIndex)}"
                try! EVY.updateValue(inDeleteMode ? "false" : "true", at: props)
            })
            if slots.count > 0 {
                lifoQueue.append(slots)
            }
        
        case .selectColumn(let x):
            var slots: [CalendarTimeslotIdentifier] = []
            timeslots[x].forEach({ slot in
                if slot.isSelected != inDeleteMode {
                    return
                }
                timeslots[slot.x][slot.y].isSelected = !inDeleteMode
                if !inDeleteMode {
                    slots.append(
                        CalendarTimeslotIdentifier(x: x, y: slot.y,
                                                   datasourceIndex: slot.datasourceIndex)
                    )
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotSelect,
                        object: CGPoint(x:x, y:slot.y)
                    )
                } else {
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotDeselect,
                        object: CGPoint(x:x, y:slot.y)
                    )
                }
                
                let props = "{pickupTimeslots[\(slot.datasourceIndex)}"
                try! EVY.updateValue(inDeleteMode ? "false" : "true", at: props)
            })
            if slots.count > 0 {
                lifoQueue.append(slots)
            }
        }
        
        if lifoQueue.count > 0 {
            withAnimation(.easeOut(duration: fadeDuration), {
                inUndoMode = true
            })
        } else {
            withAnimation(.easeOut(duration: fadeDuration), {
                inUndoMode = false
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
        .overlay(inUndoMode ? EVYCalendarButton(mode: .undo) : nil,
                 alignment: .bottom)
        .overlay(inDeleteMode ? EVYCalendarButton(mode: .done) : nil,
                 alignment: .bottom)
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
