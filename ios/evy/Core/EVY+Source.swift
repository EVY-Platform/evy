//
//  EVY+Source.swift
//  evy
//

import Foundation

extension EVY {
  enum SourceExpression: Equatable {
    case api(method: String)
    case local(props: String)
  }

  // An `.api` source is NOT resolvable via getDataFromText/store(for:);
  // it names a live API search method handled by EVYSearchModel.
  static func classifySource(_ raw: String) -> SourceExpression {
    let props = parsePropsFromText(raw)
    let apiMethod = stripApiPrefix(props)
    if apiMethod != props {
      return .api(method: apiMethod)
    }
    return .local(props: props)
  }
}
