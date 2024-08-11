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
private let columnWidth: CGFloat = 80
private let rowHeight: CGFloat = 30

/**
 * Shared calendar timeslot struct
 */
struct EVYCalendarTimeslot: Hashable {
    let x: Int
    let y: Int
    let datasourceIndex: Int
    var selected: Bool
}

/**
 * Calendar operations system
 */
enum EVYCalendarDeleteMode {
    case enter
    case exit
}
enum EVYCalendarOperation {
    case extend(timeslot: EVYCalendarTimeslot)
    case delete(timeslot: EVYCalendarTimeslot)
    case undo(tapped: Bool)
    case deleteMode(mode: EVYCalendarDeleteMode)
    case selectRow(y: Int)
    case selectColumn(x: Int)
}

struct EVYCalendarOperationKey: EnvironmentKey {
    static let defaultValue: (EVYCalendarOperation) -> Void = { _  in }
}

extension EnvironmentValues {
    var operate: (EVYCalendarOperation) -> Void {
        get { self[EVYCalendarOperationKey.self] }
        set { self[EVYCalendarOperationKey.self] = newValue }
    }
}

/**
 * Calendar timeslot event system
 */
extension Notification.Name {
    static let calendarTimeslotSelect = Notification.Name("EVYCalendarTimeslotSelect")
    static let calendarTimeslotDeselect = Notification.Name("EVYCalendarTimeslotDeselect")
    static let calendarTimeslotPrepare = Notification.Name("calendarTimeslotPrepare")
    static let calendarTimeslotUnprepare = Notification.Name("calendarTimeslotUnprepare")
}

/**
 * Main views
 */
struct EVYCalendarContentView: View {
    let numberOfDays: Int
    let numberOfTimeslotsPerDay: Int
    let primaryTimeslots: [[EVYCalendarTimeslot]]
    let secondaryTimeslots: [[EVYCalendarTimeslot]]
    
    var body: some View {
        HStack(spacing: .zero) {
            ForEach(primaryTimeslots.indices, id: \.self) { x in
                VStack(alignment: .leading, spacing: .zero) {
                    ForEach(primaryTimeslots[x].indices, id: \.self) { y in
                        let primary = primaryTimeslots[x][y]
                        let secondary = secondaryTimeslots[x][y]
                        ZStack {
                            if secondary.selected {
                                EVYCalendarTimeslotView.secondary(timeslot: secondary,
                                                                  width: columnWidth,
                                                                  height: rowHeight)
                            }
                            EVYCalendarTimeslotView.primary(timeslot: primary,
                                                            width: columnWidth,
                                                            height: rowHeight)
                        }
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
                            operate(EVYCalendarOperation.selectRow(y: y))
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
                        operate(EVYCalendarOperation.selectColumn(x: x))
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
    
    @State private var primaryTimeslots: [[EVYCalendarTimeslot]]
    @State private var secondaryTimeslots: [[EVYCalendarTimeslot]]
    @State private var scrollOffset = CGPoint.zero
    @State private var inUndoMode: Bool = false
    @State private var inDeleteMode: Bool = false
    @State private var undoQueue: [[EVYCalendarTimeslot]] = []
    
    init(primary: String, secondary: String) {
        var primaryTimeslotsData: [EVYCalendarTimeslotData] = []
        var secondaryTimeslotsData: [EVYCalendarTimeslotData] = []
        
        do {
            let timeslotsJSON = try EVY.getDataFromText(primary)
            primaryTimeslotsData = try JSONDecoder().decode(
                [EVYCalendarTimeslotData].self,
                from: timeslotsJSON.toString().data(using: .utf8)!
            )
            xLabels = primaryTimeslotsData
                .filter({ $0.y == 0})
                .map({ String($0.header) })
            yLabels = primaryTimeslotsData
                .filter({ $0.x == 0})
                .map({ $0.start_label })
            yLabels.append(primaryTimeslotsData.last!.end_label)
        } catch {}
        
        do {
            let timeslotsJSON = try EVY.getDataFromText(secondary)
            secondaryTimeslotsData = try JSONDecoder().decode(
                [EVYCalendarTimeslotData].self,
                from: timeslotsJSON.toString().data(using: .utf8)!
            )
        } catch {}
        
        let numberOfTimeslotsPerDay = yLabels.count-1
        let numberOfDays = xLabels.count
        var primaryTimeslots: [[EVYCalendarTimeslot]] = []
        var secondaryTimeslots: [[EVYCalendarTimeslot]] = []
        for x in (0..<numberOfDays) {
            var primaryRows: [EVYCalendarTimeslot] = []
            var secondaryRows: [EVYCalendarTimeslot] = []
            for y in (0..<numberOfTimeslotsPerDay) {
                let relevantIndex = y+(x*numberOfTimeslotsPerDay)
                let primarySelected = primaryTimeslotsData[relevantIndex].selected
                let secondarySelected = secondaryTimeslotsData[relevantIndex].selected

                primaryRows.append(
                    EVYCalendarTimeslot(x: x, y: y,
                                        datasourceIndex: relevantIndex,
                                        selected: primarySelected))
                secondaryRows.append(
                    EVYCalendarTimeslot(x: x, y: y,
                                        datasourceIndex: relevantIndex,
                                        selected: secondarySelected))
            }
            primaryTimeslots.append(primaryRows)
            secondaryTimeslots.append(secondaryRows)
        }
        self.primaryTimeslots = primaryTimeslots
        self.secondaryTimeslots = secondaryTimeslots
    }
    
    private func nextAvailableSlot(from: EVYCalendarTimeslot, max: Int) -> Int? {
        var index = from.y
        while (index < max) {
            if primaryTimeslots[from.x][index].selected {
                index += 1
            } else {
                return index
            }
        }
        return nil
    }
    
    private func handleOperation(_ operation: EVYCalendarOperation) {
        switch operation {
        case .extend(let timeslot):
            let slotY: Int? = nextAvailableSlot(from: timeslot,
                                                max: yLabels.count-1)
            if slotY != nil {
                primaryTimeslots[timeslot.x][slotY!].selected = true
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotSelect,
                    object: CGPoint(x:timeslot.x, y:slotY!)
                )
                undoQueue.append([primaryTimeslots[timeslot.x][slotY!]])
            }
            
        case .delete(let timeslot):
            primaryTimeslots[timeslot.x][timeslot.y].selected = false
            
            NotificationCenter.default.post(
                name: Notification.Name.calendarTimeslotDeselect,
                object: CGPoint(x:timeslot.x, y:timeslot.y)
            )
            
        case .undo(_):
            if undoQueue.count > 0 {
                let lastSlots = undoQueue.popLast()!
                lastSlots.forEach({ lastSlot in
                    primaryTimeslots[lastSlot.x][lastSlot.y].selected = false
                    
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotDeselect,
                        object: CGPoint(x:lastSlot.x, y:lastSlot.y)
                    )
                })
            }
            
        case .deleteMode(let mode):
            if mode == .enter {
                undoQueue.removeAll()
                inUndoMode = false
                inDeleteMode = true
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotPrepare,
                    object: nil)
            } else {
                NotificationCenter.default.post(
                    name: Notification.Name.calendarTimeslotUnprepare,
                    object: nil)
                inDeleteMode = false
            }
            
        case .selectRow(let y):
            var slots: [EVYCalendarTimeslot] = []
            primaryTimeslots.forEach({ column in
                let x = column.first!.x
                
                if !inDeleteMode && !primaryTimeslots[x][y].selected {
                    primaryTimeslots[x][y].selected = true
                    slots.append(primaryTimeslots[x][y])
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotSelect,
                        object: CGPoint(x:x, y:y)
                    )
                } else if inDeleteMode && primaryTimeslots[x][y].selected {
                    primaryTimeslots[x][y].selected = false
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotDeselect,
                        object: CGPoint(x:x, y:y)
                    )
                }
            })
            if slots.count > 0 {
                undoQueue.append(slots)
            }
        
        case .selectColumn(let x):
            var slots: [EVYCalendarTimeslot] = []
            primaryTimeslots[x].forEach({ slot in
                let y = slot.y
                
                if !inDeleteMode && !primaryTimeslots[x][y].selected {
                    primaryTimeslots[x][y].selected = true
                    slots.append(primaryTimeslots[x][y])
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotSelect,
                        object: CGPoint(x:x, y:y)
                    )
                } else if inDeleteMode && primaryTimeslots[x][y].selected {
                    primaryTimeslots[x][y].selected = false
                    NotificationCenter.default.post(
                        name: Notification.Name.calendarTimeslotDeselect,
                        object: CGPoint(x:x, y:y)
                    )
                }
            })
            if slots.count > 0 {
                undoQueue.append(slots)
            }
        }
        
        inUndoMode = undoQueue.count > 0 && !inDeleteMode
    }
    
    var body: some View {
        let undoButton = EVYHoveringButton(action: {
            handleOperation(EVYCalendarOperation.undo(tapped: true))
        }, icon: "arrow.uturn.backward")
        let doneButton = EVYHoveringButton(action: {
            handleOperation(EVYCalendarOperation.deleteMode(mode: .exit))
        }, icon: "checkmark")
        
        HStack(spacing: .zero) {
            EVYCalendarYAxisView(labels: yLabels, offset: $scrollOffset)
            VStack(spacing: .zero) {
                EVYCalendarXAxisView(labels: xLabels, offset: $scrollOffset)
                ScrollViewReader { _ in
                    ScrollView([.vertical, .horizontal]) {
                        EVYCalendarContentView(numberOfDays: xLabels.count,
                                               numberOfTimeslotsPerDay: yLabels.count-1,
                                               primaryTimeslots: primaryTimeslots,
                                               secondaryTimeslots: secondaryTimeslots)
                        .background( GeometryReader { geo in
                            Color.clear
                                .preference(key: ViewOffsetKey.self,
                                            value: geo.frame(in: .named("scroll")).origin)
                        })
                        .onPreferenceChange(ViewOffsetKey.self) { value in
                            scrollOffset = value
                        }
                    }
                }
                .coordinateSpace(name: "scroll")
            }
        }
        .overlay(inUndoMode ? undoButton : nil, alignment: .bottom)
        .overlay(inDeleteMode ? doneButton : nil, alignment: .bottom)
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
