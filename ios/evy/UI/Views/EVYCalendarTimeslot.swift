//
//  EVYCalendarTimeslot.swift
//  evy
//
//  Created by Geoffroy Lesage on 10/7/2024.
//

import SwiftUI

private let fadeDuration: CGFloat = 0.05
private let timeslotOpactity: CGFloat = 0.7
private let animationDuration: CGFloat = 0.15

private struct WiggleAnimation<Content: View>: View {
    var content: Content
    @Binding var animate: Bool
    @State private var wave = true

    var body: some View {
        content
        .id(animate)
        .onChange(of: animate) { oldValue, newValue in
            if newValue {
                let baseAnimation = Animation.linear(duration: animationDuration)
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

private enum EVYCalendarTimeslotViewStyle {
    case primary
    case secondary
}

struct EVYCalendarTimeslotView: View {
    @Environment(\.operate) private var operate
    
    private let id: EVYCalendarTimeslot
    private let style: EVYCalendarTimeslotViewStyle
    private let width: CGFloat
    private let height: CGFloat
    
    @State private var selected: Bool
    @State private var inDeleteMode: Bool = false
    
    public static func secondary(id: EVYCalendarTimeslot,
                                 width: CGFloat,
                                 height: CGFloat) -> EVYCalendarTimeslotView
    {
        return EVYCalendarTimeslotView(id: id,
                                       style: .secondary,
                                       selected: false,
                                       width: width,
                                       height: height)
    }
    
    public static func primary(id: EVYCalendarTimeslot,
                               width: CGFloat,
                               height: CGFloat) -> EVYCalendarTimeslotView
    {
        return EVYCalendarTimeslotView(id: id,
                                       style: .primary,
                                       selected: id.selected,
                                       width: width,
                                       height: height)
    }
    
    private init(id: EVYCalendarTimeslot,
         style: EVYCalendarTimeslotViewStyle,
         selected: Bool,
         width: CGFloat,
         height: CGFloat)
    {
        self.id = id
        self.style = style
        self.selected = selected
        self.width = width
        self.height = height
    }
    
    private func select() -> Void {
        if !selected {
            let props = "{pickupTimeslots[\(id.datasourceIndex)}"
            try! EVY.updateValue("true", at: props)
            withAnimation(.easeOut(duration: fadeDuration), {
                selected = true
            })
        }
    }
    
    private func deselect() -> Void {
        if (selected) {
            let props = "{pickupTimeslots[\(id.datasourceIndex)}"
            try! EVY.updateValue("false", at: props)
            withAnimation(.easeOut(duration: fadeDuration), {
                selected = false
            })
        }
    }
    
    var body: some View {
        WiggleAnimation(animate: $inDeleteMode, content: {
            Button(action: {}) {
                VStack(spacing: .zero) {
                    Rectangle()
                        .fill(selected ? Constants.buttonColor :
                                (style == .secondary ? Constants.inactiveBackground : .clear)
                        )
                        .opacity(timeslotOpactity)
                }
                .foregroundColor(.clear)
            }
            .simultaneousGesture(LongPressGesture()
                .onEnded { _ in
                    if !inDeleteMode {
                        operate(EVYCalendarOperation.deleteMode(mode: .enter))
                    }
                }
            )
            .highPriorityGesture(TapGesture()
                .onEnded { _ in
                    if inDeleteMode && selected {
                        operate(EVYCalendarOperation.delete(identifier: id))
                    } else if !inDeleteMode {
                        operate(EVYCalendarOperation.extend(identifier: id))
                    }
                }
            )
        })
        .frame(height: height)
        .frame(width: width)
        .onReceive(NotificationCenter.default.publisher(
            for: Notification.Name.calendarTimeslotDeselect)
        ) { notif in
            if style == .primary,
               let point = notif.object as? CGPoint,
               Int(point.x) == id.x,
               Int(point.y) == id.y
            {
                deselect()
            }
        }
        .onReceive(NotificationCenter.default.publisher(
            for: Notification.Name.calendarTimeslotSelect)
        ) { notif in
            if style == .primary,
               let point = notif.object as? CGPoint,
               Int(point.x) == id.x,
               Int(point.y) == id.y
            {
                select()
            }
        }
        .onReceive(NotificationCenter.default.publisher(
            for: Notification.Name.calendarTimeslotPrepare)
        ) { _ in
            inDeleteMode = style == .primary
        }
        .onReceive(NotificationCenter.default.publisher(
            for: Notification.Name.calendarTimeslotUnprepare)
        ) { notif in
            inDeleteMode = false
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
