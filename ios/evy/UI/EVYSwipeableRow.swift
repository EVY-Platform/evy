//
//  EVYSwipeableRow.swift
//  evy
//

import SwiftUI
import UIKit

enum EVYSwipeEndState: Equatable {
  case closed
  case open
  case execute
}

enum EVYSwipeGeometry {
  static let revealWidth: CGFloat = 72
  static let revealSnapThreshold: CGFloat = 36
  static let fullSwipeThresholdFraction: CGFloat = 0.55
  static let rubberBandFactor: CGFloat = 0.35
  static let executeFlickVelocity: CGFloat = 1000
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
    if proposedOffset < -revealWidth {
      let overshoot = proposedOffset + revealWidth
      return -revealWidth + overshoot * rubberBandFactor
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
    rowWidth: CGFloat
  ) -> EVYSwipeEndState {
    let baseOffset: CGFloat = isOpen ? -revealWidth : 0
    let rawOffset = baseOffset + translation.width
    let fullSwipeThreshold = executeThreshold(rowWidth: rowWidth)
    if rawOffset <= fullSwipeThreshold {
      return .execute
    }

    let projected = projectedOffset(rawOffset: rawOffset, velocityX: velocity.width)
    if projected <= fullSwipeThreshold && abs(velocity.width) >= executeFlickVelocity {
      return .execute
    }

    let decisionOffset =
      abs(velocity.width) < nearZeroDistance
      ? dragOffset(translation: translation, isOpen: isOpen)
      : projected
    if decisionOffset <= -revealSnapThreshold {
      return .open
    }
    return .closed
  }

  static func revealButtonWidth(for offset: CGFloat) -> CGFloat {
    max(0, max(revealWidth, -offset))
  }

  static func crossedExecuteThreshold(
    previousOffset: CGFloat,
    currentOffset: CGFloat,
    rowWidth: CGFloat
  ) -> Bool {
    let threshold = executeThreshold(rowWidth: rowWidth)
    let wasPast = previousOffset <= threshold
    let isPast = currentOffset <= threshold
    return wasPast != isPast
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

  private static func executeThreshold(rowWidth: CGFloat) -> CGFloat {
    -max(rowWidth, revealWidth) * fullSwipeThresholdFraction
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

  func closeAll() {
    openRowId = nil
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
  let onExecute: () -> Void
  private let content: () -> Content

  init(
    swipeIdentity: String,
    onExecute: @escaping () -> Void,
    @ViewBuilder content: @escaping () -> Content
  ) {
    self.swipeIdentity = swipeIdentity
    self.onExecute = onExecute
    self.content = content
  }

  @ObservedObject private var coordinator = EVYSwipeCoordinator.shared
  @State private var offset: CGFloat = 0
  @State private var isDragging = false
  @State private var wasOpenAtDragStart = false
  @State private var rowWidth: CGFloat = 0
  @State private var lastRawOffset: CGFloat = 0
  @State private var isPastExecuteThreshold = false
  @State private var isSettlingFromGesture = false
  @State private var impactFeedback = UIImpactFeedbackGenerator(style: .medium)

  private var isOpen: Bool {
    coordinator.openRowId == swipeIdentity
  }

  var body: some View {
    ZStack(alignment: .trailing) {
      trailingActionButton
        .opacity(offset < 0 ? 1 : 0)
        .allowsHitTesting(offset < -1)

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
          if isOpen && !isDragging {
            Constants.tappableClearColor
              .contentShape(Rectangle())
              .onTapGesture {
                settle(to: 0, velocityX: 0)
              }
          }
        }
    }
    .contentShape(Rectangle())
    .clipped()
    .overlay {
      EVYSwipePanOverlay(
        isOpen: isOpen,
        onBegan: { open in
          wasOpenAtDragStart = open
          isDragging = true
          lastRawOffset = open ? -EVYSwipeGeometry.revealWidth : 0
          isPastExecuteThreshold = false
          impactFeedback.prepare()
          if let openId = coordinator.openRowId, openId != swipeIdentity {
            coordinator.close(openId)
            wasOpenAtDragStart = false
            lastRawOffset = 0
          }
        },
        onChanged: { translation in
          let baseOffset: CGFloat =
            wasOpenAtDragStart ? -EVYSwipeGeometry.revealWidth : 0
          let rawOffset = baseOffset + translation.width
          let nextOffset = EVYSwipeGeometry.dragOffset(
            translation: translation,
            isOpen: wasOpenAtDragStart
          )
          if EVYSwipeGeometry.crossedExecuteThreshold(
            previousOffset: lastRawOffset,
            currentOffset: rawOffset,
            rowWidth: rowWidth
          ) {
            isPastExecuteThreshold = !isPastExecuteThreshold
            impactFeedback.impactOccurred()
          }
          lastRawOffset = rawOffset
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
            isOpen: wasOpenAtDragStart,
            rowWidth: rowWidth
          )
          switch endState {
          case .closed:
            settle(to: 0, velocityX: velocity.width)
          case .open:
            settle(to: -EVYSwipeGeometry.revealWidth, velocityX: velocity.width)
          case .execute:
            executeWithCommitSweep()
          }
        }
      )
    }
    .onPreferenceChange(EVYSwipeRowWidthKey.self) { width in
      rowWidth = width
    }
    .onChange(of: coordinator.openRowId) { _, openId in
      guard !isDragging, !isSettlingFromGesture else { return }
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
      ZStack(alignment: .trailing) {
        Constants.actionColor
          .frame(width: EVYSwipeGeometry.revealButtonWidth(for: offset))

        Image(systemName: "ellipsis")
          .font(.system(size: 20, weight: .semibold))
          .foregroundStyle(.white)
          .frame(width: EVYSwipeGeometry.revealWidth)
          .frame(maxHeight: .infinity)
      }
      .frame(maxHeight: .infinity)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Slide left")
    .accessibilityIdentifier("slideLeft_\(swipeIdentity)")
  }

  private func settle(to targetOffset: CGFloat, velocityX: CGFloat) {
    isSettlingFromGesture = true
    if targetOffset == 0 {
      coordinator.close(swipeIdentity)
    } else {
      coordinator.open(swipeIdentity)
    }
    isSettlingFromGesture = false
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
    isSettlingFromGesture = true
    coordinator.close(swipeIdentity)
    isSettlingFromGesture = false
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
  static var defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
    value = nextValue()
  }
}

private struct EVYSwipePanOverlay: UIViewRepresentable {
  let isOpen: Bool
  let onBegan: (_ isOpen: Bool) -> Void
  let onChanged: (CGSize) -> Void
  let onEnded: (_ translation: CGSize, _ velocity: CGSize) -> Void

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
    context.coordinator.pan = pan
    return view
  }

  func updateUIView(_ uiView: UIView, context: Context) {
    context.coordinator.parent = self
  }

  final class Coordinator: NSObject, UIGestureRecognizerDelegate {
    var parent: EVYSwipePanOverlay
    weak var pan: UIPanGestureRecognizer?
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

    func gestureRecognizer(
      _ gestureRecognizer: UIGestureRecognizer,
      shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
      true
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
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
