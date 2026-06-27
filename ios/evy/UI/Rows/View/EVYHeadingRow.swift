import SwiftUI

struct EVYHeadingRow: View {

  private let view: HeadingRowViewData

  init(view: HeadingRowViewData) {
    self.view = view
  }

  var body: some View {
    let content = view

    HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading) {
        if !content.title.isEmpty {
          EVYTextView(content.title).toText().bold()
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(1)
            .truncationMode(.tail)
        }
      }
      if !content.label.isEmpty {
        EVYTextView(content.label, style: .info)
      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}
