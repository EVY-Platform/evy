//
//  EVYCalendarAxisView.swift
//  evy
//

import SwiftUI

let spaceForFirstLabel: CGFloat = 6
let columnWidth: CGFloat = 80
let rowHeight: CGFloat = 30

struct EVYCalendarLabel {
    let value: String
    var full: Bool
}

struct EVYAxisLabel: View {
    let label: String
    let full: Bool
    let action: (_ full: Bool) -> Void

    var body: some View {
        Button(
            action: { action(full) },
            label: {
                let labelText = label.count > 0 ? label : "-"
                EVYTextView(labelText, style: full ? .action : .info)
            }
        )
        .frame(height: rowHeight)
        .frame(width: columnWidth)
    }
}

enum EVYAxisType {
    case x
    case y
}

struct EVYCalendarAxisView: View {
    @Environment(\.operate) private var operate
    let type: EVYAxisType
    let labels: [EVYCalendarLabel]
    @Binding var offset: CGPoint

    var body: some View {
        switch type {
        case .x:
            ScrollView([.horizontal]) {
                HStack(spacing: .zero) {
                    ForEach(labels.indices, id: \.self) { x in
                        EVYAxisLabel(
                            label: labels[x].value,
                            full: labels[x].full,
                            action: { full in
                                if full {
                                    operate(EVYCalendarOperation.unselectColumn(x: x))
                                } else {
                                    operate(EVYCalendarOperation.selectColumn(x: x))
                                }
                            })
                    }
                }.offset(x: offset.x)
            }.scrollDisabled(true)
        case .y:
            VStack(spacing: .zero) {
                Color.clear.frame(width: .zero, height: rowHeight - spaceForFirstLabel)
                ScrollView([.vertical]) {
                    VStack(spacing: .zero) {
                        ForEach(labels.indices, id: \.self) { y in
                            EVYAxisLabel(
                                label: labels[y].value,
                                full: labels[y].full,
                                action: { full in
                                    if full {
                                        operate(EVYCalendarOperation.unselectRow(y: y))
                                    } else {
                                        operate(EVYCalendarOperation.selectRow(y: y))
                                    }
                                })
                        }
                    }.offset(y: offset.y - spaceForFirstLabel)
                }.scrollDisabled(true)
            }
        }
    }
}
