//
//  EVYSearch.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYSearch: View {
    private let canSelectMultiple: Bool

    let source: String
    let destination: String
    let placeholder: String
    let resultTemplate: UI_Row?

    init(
        source: String,
        destination: String,
        placeholder: String,
        resultTemplate: UI_Row?,
    ) {
        self.source = source
        self.destination = destination
        self.placeholder = placeholder
        self.resultTemplate = resultTemplate

        do {
            let data = try EVY.getDataFromText(destination)
            if case .array = data {
                canSelectMultiple = true
            } else {
                canSelectMultiple = false
            }
        } catch {
            canSelectMultiple = false
        }
    }

    var body: some View {
        if canSelectMultiple {
            EVYSearchMultiple(
                source: source,
                resultTemplate: resultTemplate,
                destination: destination,
                placeholder: placeholder,
            )
        } else {
            EVYSearchSingle(
                source: source,
                resultTemplate: resultTemplate,
                destination: destination,
                placeholder: placeholder,
            )
        }
    }
}
