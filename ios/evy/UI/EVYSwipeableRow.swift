//
//  EVYSwipeableRow.swift
//  evy
//

import SwiftUI
import UIKit

enum EVYSwipeEndState {
  case closed
  case open
}

/// One button behind a swipeable row.
///
/// A row's `swipe-left` action list is a single affordance, so SDUI produces exactly one of
/// these. `EVYMessageRequest` produces two, which is why this is a list rather than the
/// label-and-handler pair it replaces.
struct EVYSwipeAction: Identifiable {
  /// Accessibility suffix, and how a test names the button: "accept", "reject", "cancel".
  /// Empty for the single SDUI affordance, which keeps its existing identifier.
  let id: String
  /// EVY text, so an icon token like `::check::` resolves to its Lucide glyph.
  let label: String
  let tint: Color
  let run: () -> Void
}

enum EVYSwipeGeometry {
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

  static func dragOffset(translation: CGSize, isOpen: Bool) -> CGFloat {
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
    isOpen: Bool
  ) -> EVYSwipeEndState {
    let baseOffset: CGFloat = isOpen ? -revealWidth : 0
    let rawOffset = baseOffset + translation.width
    let decisionOffset =
      abs(velocity.width) < nearZeroDistance
      ? dragOffset(translation: translation, isOpen: isOpen)
      : projectedOffset(rawOffset: rawOffset, velocityX: velocity.width)
    if decisionOffset <= -revealSnapThreshold {
      return .open
    }
    return .closed
  }

  static func revealButtonWidth(for offset: CGFloat) -> CGFloat {
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
  let swipeLabel: String?
  let onExecute: () -> Void
  private let content: () -> Content

  init(
    swipeIdentity: String,
    swipeLabel: String,
    onExecute: @escaping () -> Void,
    @ViewBuilder content: @escaping () -> Content
  ) {
    self.swipeIdentity = swipeIdentity
    let trimmedLabel = swipeLabel.trimmingCharacters(in: .whitespacesAndNewlines)
    self.swipeLabel = trimmedLabel.isEmpty ? nil : trimmedLabel
    self.onExecute = onExecute
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

  var body: some View {
    // Action button must be above content in the ZStack. Content stays full-width and only
    // moves visually via offset, so when drawn on top it still owns the revealed trailing
    // hit region and turns button taps into tap-to-close (no onExecute / status update).
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
        .overlay {
          EVYSwipePanOverlay(
            isOpen: isOpen,
            onBegan: { open in
              wasOpenAtDragStart = open
              isDragging = true
              if let openId = coordinator.openRowId, openId != swipeIdentity {
                coordinator.close(openId)
                wasOpenAtDragStart = false
              }
            },
            onChanged: { translation in
              let nextOffset = EVYSwipeGeometry.dragOffset(
                translation: translation,
                isOpen: wasOpenAtDragStart
              )
              var transaction = Transaction()
              transaction.disablesAnimations = true
              withTransaction(transaction) {
                offset = nextOffset
              }
            },
            onEnded: { translation, velocity in
              isDragging = false
              let endState = EVYSwipeGeometry.endState(
                translation: translation,
                velocity: velocity,
                isOpen: wasOpenAtDragStart
              )
              switch endState {
              case .closed:
                settle(to: 0, velocityX: velocity.width)
              case .open:
                settle(to: -EVYSwipeGeometry.revealWidth, velocityX: velocity.width)
              }
            },
            onTapWhenOpen: {
              settle(to: 0, velocityX: 0)
            }
          )
        }

      trailingActionButton
        .frame(width: EVYSwipeGeometry.revealButtonWidth(for: offset))
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
      let target: CGFloat = openId == swipeIdentity ? -EVYSwipeGeometry.revealWidth : 0
      guard offset != target else { return }
      withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
        offset = target
      }
    }
  }

  private var trailingActionButton: some View {
    Button {
      executeWithCommitSweep()
    } label: {
      Group {
        if let swipeLabel {
          EVYTextView(swipeLabel, style: .button)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        } else {
          Image(systemName: "ellipsis")
            .font(.system(size: 20, weight: .semibold))
        }
      }
      .foregroundStyle(.white)
      .frame(maxWidth: .infinity)
      .frame(maxHeight: .infinity)
      .background(Constants.actionColor)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(swipeLabel ?? "Swipe left")
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
    let sweepTarget = -max(rowWidth, EVYSwipeGeometry.revealWidth)
    withAnimation(.easeOut(duration: 0.15), completionCriteria: .logicallyComplete) {
      offset = sweepTarget
    } completion: {
      var transaction = Transaction()
      transaction.disablesAnimations = true
      withTransaction(transaction) {
        offset = 0
      }
    }
    onExecute()
  }
}

private struct EVYSwipeRowWidthKey: PreferenceKey {
  static let defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
    value = nextValue()
  }
}

private struct EVYSwipePanOverlay: UIViewRepresentable {
  let isOpen: Bool
  let onBegan: (_ isOpen: Bool) -> Void
  let onChanged: (CGSize) -> Void
  let onEnded: (_ translation: CGSize, _ velocity: CGSize) -> Void
  let onTapWhenOpen: () -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator(parent: self)
  }

  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    view.backgroundColor = .clear
    let pan = UIPanGestureRecognizer(
      target: context.coordinator,
      action: #selector(Coordinator.handlePan(_:))
    )
    pan.delegate = context.coordinator
    pan.cancelsTouchesInView = false
    view.addGestureRecognizer(pan)

    let tap = UITapGestureRecognizer(
      target: context.coordinator,
      action: #selector(Coordinator.handleTap(_:))
    )
    tap.delegate = context.coordinator
    tap.require(toFail: pan)
    view.addGestureRecognizer(tap)
    context.coordinator.tap = tap
    return view
  }

  func updateUIView(_ uiView: UIView, context: Context) {
    context.coordinator.parent = self
  }

  final class Coordinator: NSObject, UIGestureRecognizerDelegate {
    var parent: EVYSwipePanOverlay
    weak var tap: UITapGestureRecognizer?
    private var didBegin = false

    init(parent: EVYSwipePanOverlay) {
      self.parent = parent
    }

    @objc func handlePan(_ recognizer: UIPanGestureRecognizer) {
      let translation = recognizer.translation(in: recognizer.view)
      let size = CGSize(width: translation.x, height: translation.y)

      switch recognizer.state {
      case .began, .changed:
        guard EVYSwipeGeometry.isHorizontalDominant(translation: size) else { return }
        if !parent.isOpen && translation.x >= 0 { return }
        if !didBegin {
          didBegin = true
          parent.onBegan(parent.isOpen)
        }
        parent.onChanged(size)
      case .ended, .cancelled, .failed:
        if didBegin {
          let velocityPoint = recognizer.velocity(in: recognizer.view)
          let velocity = CGSize(width: velocityPoint.x, height: velocityPoint.y)
          parent.onEnded(size, velocity)
        }
        didBegin = false
      default:
        break
      }
    }

    @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
      guard parent.isOpen, recognizer.state == .ended else { return }
      parent.onTapWhenOpen()
    }

    func gestureRecognizer(
      _ gestureRecognizer: UIGestureRecognizer,
      shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
      true
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
      if gestureRecognizer === tap {
        return parent.isOpen
      }
      guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return true }
      let velocity = pan.velocity(in: pan.view)
      if abs(velocity.y) >= abs(velocity.x) {
        return false
      }
      if !parent.isOpen && velocity.x > 0 {
        return false
      }
      return true
    }
  }
}
