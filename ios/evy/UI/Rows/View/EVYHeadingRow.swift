import SwiftUI

struct EVYHeadingRow: View {

  private let view: HeadingRowViewData

  init(view: HeadingRowViewData) {
    self.view = view
  }

  var body: some View {
    EVYTitleSubtitleRow(
      title: view.title,
      titleBold: true
    ) {
      if let label = view.label, !label.isEmpty {
        EVYTextView(label, style: .info)
      }
    }
  }
}
