//
//  EVYSwipeableRow.swift
//  evy
//

import SwiftUI

enum EVYSwipeEndState {
  case closed
  case open
}

enum EVYSwipeGeometry {
  /// Revealed button width, and how far a row opens.
  static let revealWidth: CGFloat = 72
  static let revealSnapThreshold: CGFloat = 36
  static let maxStretchWidth: CGFloat = revealWidth * 2
  static let rubberBandFactor: CGFloat = 0.35
  static let decelerationRate: CGFloat = 0.998

  private static let projectionFactor: CGFloat =
    decelerationRate / (1 - decelerationRate) / 1000
  private static let springVelocityClamp: CGFloat = 40
  private static let nearZeroDistance: CGFloat = 0.5

  static func isHorizontalDominant(translation: CGSize) -> Bool {
    abs(translation.width) > abs(translation.height)
  }

  static func dragOffset(
    translation: CGSize,
    isOpen: Bool,
    revealWidth: CGFloat = revealWidth
  ) -> CGFloat {
    let maxStretchWidth = revealWidth * 2
    let baseOffset: CGFloat = isOpen ? -revealWidth : 0
    let proposedOffset = baseOffset + translation.width
    if proposedOffset > 0 {
      return 0
    }
    if proposedOffset < -maxStretchWidth {
      let overshoot = proposedOffset + maxStretchWidth
      return -maxStretchWidth + overshoot * rubberBandFactor
    }
    return proposedOffset
  }

  static func projectedOffset(rawOffset: CGFloat, velocityX: CGFloat) -> CGFloat {
    rawOffset + velocityX * projectionFactor
  }

  static func endState(
    translation: CGSize,
    velocity: CGSize,
    isOpen: Bool,
    revealWidth: CGFloat = revealWidth
  ) -> EVYSwipeEndState {
    let baseOffset: CGFloat = isOpen ? -revealWidth : 0
    let rawOffset = baseOffset + translation.width
    let decisionOffset =
      abs(velocity.width) < nearZeroDistance
      ? dragOffset(translation: translation, isOpen: isOpen, revealWidth: revealWidth)
      : projectedOffset(rawOffset: rawOffset, velocityX: velocity.width)
    if decisionOffset <= -revealSnapThreshold {
      return .open
    }
    return .closed
  }

  /// The revealed strip stretches past its resting width on an over-swipe, so the button
  /// keeps filling it rather than leaving a gap.
  static func revealButtonWidth(
    for offset: CGFloat,
    revealWidth: CGFloat = revealWidth
  ) -> CGFloat {
    max(revealWidth, -offset)
  }

  static func springInitialVelocity(
    velocityX: CGFloat,
    currentOffset: CGFloat,
    targetOffset: CGFloat
  ) -> CGFloat {
    let distance = targetOffset - currentOffset
    guard abs(distance) >= nearZeroDistance else { return 0 }
    let normalized = velocityX / distance
    return min(springVelocityClamp, max(-springVelocityClamp, normalized))
  }
}

@MainActor
final class EVYSwipeCoordinator: ObservableObject {
  static let shared = EVYSwipeCoordinator()

  @Published private(set) var openRowId: String?

  func open(_ rowId: String) {
    openRowId = rowId
  }

  func close(_ rowId: String) {
    if openRowId == rowId {
      openRowId = nil
    }
  }
}

enum EVYSwipeRowIdentity {
  static func make(rowId: String, datum: EVYJson?) -> String {
    guard case .dictionary(let values) = datum,
      case .string(let datumId) = values["id"],
      !datumId.isEmpty
    else {
      return rowId
    }
    return "\(rowId)_\(datumId)"
  }
}

struct EVYSwipeableRow<Content: View>: View {
  let swipeIdentity: String
  let label: String
  let run: () -> Void
  private let content: () -> Content

  init(
    swipeIdentity: String,
    label: String,
    run: @escaping () -> Void,
    @ViewBuilder content: @escaping () -> Content
  ) {
    self.swipeIdentity = swipeIdentity
    self.label = label
    self.run = run
    self.content = content
  }

  @ObservedObject private var coordinator = EVYSwipeCoordinator.shared
  @State private var offset: CGFloat = 0
  @State private var isDragging = false
  @State private var wasOpenAtDragStart = false
  @State private var rowWidth: CGFloat = 0

  private var isOpen: Bool {
    coordinator.openRowId == swipeIdentity
  }

  private var revealWidth: CGFloat {
    EVYSwipeGeometry.revealWidth
  }

  var body: some View {
    // Action button must be above content in the ZStack. Content stays full-width and only
    // moves visually via offset, so when drawn on top it still owns the revealed trailing
    // hit region — a clear cover when open turns those taps into close-without-action.
    ZStack(alignment: .trailing) {
      content()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
          GeometryReader { geometry in
            Color.clear
              .preference(key: EVYSwipeRowWidthKey.self, value: geometry.size.width)
          }
        )
        .offset(x: offset)
        .contentShape(Rectangle())
        .gesture(swipeDragGesture)
        .overlay {
          if isOpen && !isDragging {
            Color.clear
              .contentShape(Rectangle())
              .onTapGesture {
                settle(to: 0, velocityX: 0)
              }
          }
        }

      trailingActionButton
        .frame(
          width: EVYSwipeGeometry.revealButtonWidth(for: offset, revealWidth: revealWidth)
        )
        .opacity(offset < 0 ? 1 : 0)
        .allowsHitTesting(offset <= -EVYSwipeGeometry.revealSnapThreshold && !isDragging)
    }
    .contentShape(Rectangle())
    .clipped()
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("swipeRow_\(swipeIdentity)")
    .onPreferenceChange(EVYSwipeRowWidthKey.self) { width in
      rowWidth = width
    }
    .onChange(of: coordinator.openRowId) { _, openId in
      guard !isDragging else { return }
      let target: CGFloat = openId == swipeIdentity ? -revealWidth : 0
      guard offset != target else { return }
      withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
        offset = target
      }
    }
  }

  /// `minimumDistance` keeps short presses as taps on the content (e.g. opening a sheet).
  private var swipeDragGesture: some Gesture {
    DragGesture(minimumDistance: 12, coordinateSpace: .local)
      .onChanged { value in
        let translation = value.translation
        guard EVYSwipeGeometry.isHorizontalDominant(translation: translation) else { return }
        if !isOpen && translation.width >= 0 { return }

        if !isDragging {
          wasOpenAtDragStart = isOpen
          isDragging = true
          if let openId = coordinator.openRowId, openId != swipeIdentity {
            coordinator.close(openId)
            wasOpenAtDragStart = false
          }
        }

        let nextOffset = EVYSwipeGeometry.dragOffset(
          translation: translation,
          isOpen: wasOpenAtDragStart,
          revealWidth: revealWidth
        )
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
          offset = nextOffset
        }
      }
      .onEnded { value in
        guard isDragging else { return }
        isDragging = false
        let velocity = CGSize(
          width: value.predictedEndTranslation.width - value.translation.width,
          height: value.predictedEndTranslation.height - value.translation.height
        )
        let endState = EVYSwipeGeometry.endState(
          translation: value.translation,
          velocity: velocity,
          isOpen: wasOpenAtDragStart,
          revealWidth: revealWidth
        )
        switch endState {
        case .closed:
          settle(to: 0, velocityX: velocity.width)
        case .open:
          settle(to: -revealWidth, velocityX: velocity.width)
        }
      }
  }

  private var trailingActionButton: some View {
    let trimmedLabel = label.trimmingCharacters(in: .whitespacesAndNewlines)

    return Button {
      executeWithCommitSweep()
    } label: {
      Group {
        if trimmedLabel.isEmpty {
          Image(systemName: "ellipsis")
            .font(.system(size: 20, weight: .semibold))
        } else {
          EVYTextView(trimmedLabel, style: .button)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
      }
      .foregroundStyle(.white)
      .frame(maxWidth: .infinity)
      .frame(maxHeight: .infinity)
      .background(Constants.actionColor)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(trimmedLabel.isEmpty ? "Swipe left" : trimmedLabel)
    .accessibilityIdentifier("swipeLeft_\(swipeIdentity)")
  }

  private func settle(to targetOffset: CGFloat, velocityX: CGFloat) {
    if targetOffset == 0 {
      coordinator.close(swipeIdentity)
    } else {
      coordinator.open(swipeIdentity)
    }
    guard offset != targetOffset else { return }
    let initialVelocity = EVYSwipeGeometry.springInitialVelocity(
      velocityX: velocityX,
      currentOffset: offset,
      targetOffset: targetOffset
    )
    withAnimation(
      .interpolatingSpring(stiffness: 320, damping: 30, initialVelocity: initialVelocity)
    ) {
      offset = targetOffset
    }
  }

  private func executeWithCommitSweep() {
    coordinator.close(swipeIdentity)
    let sweepTarget = -max(rowWidth, revealWidth)
    withAnimation(.easeOut(duration: 0.15), completionCriteria: .logicallyComplete) {
      offset = sweepTarget
    } completion: {
      var transaction = Transaction()
      transaction.disablesAnimations = true
      withTransaction(transaction) {
        offset = 0
      }
    }
    run()
  }
}

private struct EVYSwipeRowWidthKey: PreferenceKey {
  static let defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
    value = nextValue()
  }
}
