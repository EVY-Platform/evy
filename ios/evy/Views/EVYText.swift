//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

public enum EVYTextTypes: String, CodingKey {
    case text = "text"
    case image = "image"
}

struct EVYTextContent: View {
    let input: String
    let type: EVYTextTypes
    
    var body: some View {
        switch type {
        case .image:
            Image(systemName: input)
        default:
            Text(input.trimmingCharacters(in: .whitespaces))
        }
    }
}

struct EVYText: View {
    private var views: [EVYTextContent] = []
    
    init(_ input: String) {
        let splitInput = input.components(separatedBy:  Constants.iconSeparator)
            .flatMap { [$0, Constants.iconSeparator] }
            .dropLast()
            .filter { $0 != "" }
        
        if (splitInput.count > 1) {
            var iconSeparator: Bool = false
            for index in 0...splitInput.count-1 {
                if (splitInput[index] == Constants.iconSeparator) {
                    iconSeparator = !iconSeparator
                } else {
                    let stringInput = String(splitInput[index])
                    let view = EVYTextContent(input: stringInput,
                                              type: iconSeparator ? .image : .text)
                    self.views.append(view)
                }
            }
        } else {
            self.views.append(EVYTextContent(input: input, type: .text))
        }
    }
    
    var body: some View {
        HStack {
            ForEach(views.indices, id: \.self) { index in
                views[index]
            }
        }
    }
}

#Preview {
    EVYText("::star.square.on.square.fill:: 88% - ::star.square.on.square.fill::4 items sold")
}
