//
//  EVYCalendarTimeslot.swift
//  evy
//
//  Created by Geoffroy Lesage on 10/7/2024.
//

import SwiftUI

private let timeslotOpactity: CGFloat = 0.7
private let animationDuration: CGFloat = 0.1
private let tappableClearColor: Color = Color.black.opacity(0.0001)

private enum EVYCalendarTimeslotViewStyle {
    case primary
    case secondary
}

struct EVYCalendarTimeslotView: View {
    @Environment(\.operate) private var operate
    
    private let timeslot: EVYCalendarTimeslot
    private let style: EVYCalendarTimeslotViewStyle
    private let width: CGFloat
    private let height: CGFloat
    
    @State private var selected: Bool
    @State private var inDeleteMode: Bool = false
    
    public static func secondary(timeslot: EVYCalendarTimeslot,
                                 width: CGFloat,
                                 height: CGFloat) -> EVYCalendarTimeslotView
    {
        return EVYCalendarTimeslotView(timeslot: timeslot,
                                       style: .secondary,
                                       width: width,
                                       height: height)
    }
    
    public static func primary(timeslot: EVYCalendarTimeslot,
                               width: CGFloat,
                               height: CGFloat) -> EVYCalendarTimeslotView
    {
        return EVYCalendarTimeslotView(timeslot: timeslot,
                                       style: .primary,
                                       width: width,
                                       height: height)
    }
    
    private init(timeslot: EVYCalendarTimeslot,
                 style: EVYCalendarTimeslotViewStyle,
                 width: CGFloat,
                 height: CGFloat)
    {
        self.timeslot = timeslot
        self.style = style
        self.selected = style == .primary && timeslot.selected
        self.width = width
        self.height = height
    }
    
    private func select() -> Void {
        if !selected {
            withAnimation(.linear(duration: animationDuration)) {
                selected = true
            }
            let props = "{pickupTimeslots[\(timeslot.datasourceIndex)}"
            try! EVY.updateValue("true", at: props)
        }
    }
    
    private func deselect() -> Void {
        if (selected) {
            withAnimation(.linear(duration: animationDuration)) {
                selected = false
            }
            let props = "{pickupTimeslots[\(timeslot.datasourceIndex)}"
            try! EVY.updateValue("false", at: props)
        }
    }
    
    var body: some View {
        Rectangle()
            .fill(selected ? Constants.buttonColor :
                    (style == .secondary ? Constants.inactiveBackground : tappableClearColor)
            )
            .frame(height: height)
            .frame(width: width)
            .onTapGesture {
                if selected {
                    operate(EVYCalendarOperation.delete(timeslot: timeslot))
                } else {
                    operate(EVYCalendarOperation.add(timeslot: timeslot))
                }
            }
            .onReceive(NotificationCenter.default.publisher(
                for: Notification.Name.calendarTimeslotDeselect)
            ) { notif in
                if style == .primary,
                   let point = notif.object as? CGPoint,
                   Int(point.x) == timeslot.x,
                   Int(point.y) == timeslot.y
                {
                    deselect()
                }
            }
            .onReceive(NotificationCenter.default.publisher(
                for: Notification.Name.calendarTimeslotSelect)
            ) { notif in
                if style == .primary,
                   let point = notif.object as? CGPoint,
                   Int(point.x) == timeslot.x,
                   Int(point.y) == timeslot.y
                {
                    select()
                }
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
