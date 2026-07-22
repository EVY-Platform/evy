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
  static let engagementMinimumDistance: CGFloat = 12
  static let revealWidth: CGFloat = 72
  static let revealSnapThreshold: CGFloat = 36
  static let fullSwipeThresholdFraction: CGFloat = 0.55
  static let rubberBandFactor: CGFloat = 0.35

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

  static func endState(
    translation: CGSize,
    isOpen: Bool,
    rowWidth: CGFloat
  ) -> EVYSwipeEndState {
    let baseOffset: CGFloat = isOpen ? -revealWidth : 0
    let rawOffset = baseOffset + translation.width
    let fullSwipeThreshold = -max(rowWidth, revealWidth) * fullSwipeThresholdFraction
    if rawOffset <= fullSwipeThreshold {
      return .execute
    }
    let displayOffset = dragOffset(translation: translation, isOpen: isOpen)
    if displayOffset <= -revealSnapThreshold {
      return .open
    }
    return .closed
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

struct EVYSwipeableRow<Content: View>: View {
  let rowId: String
  let onExecute: () -> Void
  @ViewBuilder let content: () -> Content

  @ObservedObject private var coordinator = EVYSwipeCoordinator.shared
  @State private var dragOffset: CGFloat = 0
  @State private var isDragging = false
  @State private var wasOpenAtDragStart = false
  @State private var rowWidth: CGFloat = 0

  private var isOpen: Bool {
    coordinator.openRowId == rowId
  }

  private var contentOffset: CGFloat {
    if isDragging {
      return dragOffset
    }
    return isOpen ? -EVYSwipeGeometry.revealWidth : 0
  }

  var body: some View {
    ZStack(alignment: .trailing) {
      trailingActionButton
        .frame(width: EVYSwipeGeometry.revealWidth)
        .opacity(contentOffset < 0 ? 1 : 0)
        .allowsHitTesting(contentOffset < -1)

      content()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
          GeometryReader { geometry in
            Color.clear
              .preference(key: EVYSwipeRowWidthKey.self, value: geometry.size.width)
          }
        )
        .offset(x: contentOffset)
        .overlay {
          if isOpen && !isDragging {
            Constants.tappableClearColor
              .contentShape(Rectangle())
              .onTapGesture {
                closeWithAnimation()
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
          if let openId = coordinator.openRowId, openId != rowId {
            coordinator.close(openId)
            wasOpenAtDragStart = false
          }
        },
        onChanged: { translation in
          dragOffset = EVYSwipeGeometry.dragOffset(
            translation: translation,
            isOpen: wasOpenAtDragStart
          )
        },
        onEnded: { translation in
          isDragging = false
          let endState = EVYSwipeGeometry.endState(
            translation: translation,
            isOpen: wasOpenAtDragStart,
            rowWidth: rowWidth
          )
          switch endState {
          case .closed:
            closeWithAnimation()
          case .open:
            openWithAnimation()
          case .execute:
            executeAndClose()
          }
        }
      )
    }
    .onPreferenceChange(EVYSwipeRowWidthKey.self) { width in
      rowWidth = width
    }
    .onChange(of: coordinator.openRowId) { _, openId in
      guard !isDragging else { return }
      withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
        dragOffset = openId == rowId ? -EVYSwipeGeometry.revealWidth : 0
      }
    }
  }

  private var trailingActionButton: some View {
    Button {
      executeAndClose()
    } label: {
      Image(systemName: "ellipsis")
        .font(.system(size: 20, weight: .semibold))
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .frame(maxHeight: .infinity)
        .background(Constants.actionColor)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Slide left")
    .accessibilityIdentifier("slideLeft_\(rowId)")
  }

  private func openWithAnimation() {
    coordinator.open(rowId)
    withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
      dragOffset = -EVYSwipeGeometry.revealWidth
    }
  }

  private func closeWithAnimation() {
    coordinator.close(rowId)
    withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
      dragOffset = 0
    }
  }

  private func executeAndClose() {
    closeWithAnimation()
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
  let onEnded: (CGSize) -> Void

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
          parent.onEnded(size)
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
