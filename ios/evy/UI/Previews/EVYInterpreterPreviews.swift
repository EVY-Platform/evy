//
//  EVYInterpreterPreviews.swift
//  evy
//

import SwiftUI

#Preview {
  EVYInterpreterPreview()
}

private struct EVYInterpreterPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    let bare = "test"
    let data = "{item.title}"

    let parsedData = try! parseTextFromText(data)
    let withPrefix = try! parseTextFromText(
      "{formatCurrency(item.price)}"
    )
    let withSuffix = try! parseTextFromText(
      "{formatDimension(item.dimensions.width)}"
    )
    let WithSuffixAndRight = try! parseTextFromText(
      "{formatDimension(item.dimensions.width)} - {item.title}"
    )
    let withComparison = try! parseTextFromText(
      "{count(item.title) == count(selling_reasons)} v {count(item.title) == count(item.title)}"
    )
    let withMultiComparison = try! parseTextFromText(
      "{count(item.title) > 0 || (1 > 2 && count(selling_reasons) > 0)}"
    )

    let weight = try! parseTextFromText(
      "{formatWeight(item.dimensions.weight)}"
    )

    let firstSellingReason = try! EVY.getDataFromText("{selling_reasons[0]}")

    return VStack {
      Text("parseProps but no props: " + _parsePropsFromText(bare))
      Text("parseProps with props: " + _parsePropsFromText(data))
      Text(parsedData.toString())
      Text(withPrefix.toString())
      Text(withSuffix.toString())
      Text(WithSuffixAndRight.toString())
      Text(withComparison.toString())
      Text(withMultiComparison.toString())
      Text(weight.toString())
      Text(firstSellingReason.toString())

      EVYTextField(
        source: "{formatCurrency(item.price)}",
        destination: "{item.price}",
        placeholder: "Editing price")
    }
  }
}
