//
//  EVYCalendarAxisView.swift
//  evy
//

import SwiftUI

private let spaceForFirstLabel: CGFloat = 6
let columnWidth: CGFloat = 80
let rowHeight: CGFloat = 30

struct EVYCalendarLabel: Equatable {
  let value: String
  var full: Bool
}

private struct EVYAxisLabel: View {
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
        labelStack(axisOffset: offset.x, scrollAxis: .horizontal)
      }.scrollDisabled(true)
    case .y:
      VStack(spacing: .zero) {
        Color.clear.frame(width: .zero, height: rowHeight - spaceForFirstLabel)
        ScrollView([.vertical]) {
          labelStack(axisOffset: offset.y - spaceForFirstLabel, scrollAxis: .vertical)
        }.scrollDisabled(true)
      }
    }
  }

  @ViewBuilder
  private func labelStack(axisOffset: CGFloat, scrollAxis: Axis) -> some View {
    let stack = Group {
      ForEach(labels.indices, id: \.self) { index in
        EVYAxisLabel(
          label: labels[index].value,
          full: labels[index].full,
          action: { full in handleLabelTap(index: index, full: full) }
        )
      }
    }
    switch scrollAxis {
    case .horizontal:
      HStack(spacing: .zero) { stack }.offset(x: axisOffset)
    case .vertical:
      VStack(spacing: .zero) { stack }.offset(y: axisOffset)
    }
  }

  private func handleLabelTap(index: Int, full: Bool) {
    switch type {
    case .x:
      if full {
        operate(EVYCalendarOperation.unselectColumn(x: index))
      } else {
        operate(EVYCalendarOperation.selectColumn(x: index))
      }
    case .y:
      if full {
        operate(EVYCalendarOperation.unselectRow(y: index))
      } else {
        operate(EVYCalendarOperation.selectRow(y: index))
      }
    }
  }
}
