//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

func EVYText(_ input: String) -> Text {
    var text: Text = Text("")
    
    let splitInput = input.components(separatedBy:  Constants.iconSeparator)
        .flatMap { [$0, Constants.iconSeparator] }
        .dropLast()
        .filter { $0 != "" }
    
    var imageMode: Bool = false
    for index in 0...splitInput.count-1 {
        if (splitInput[index] == Constants.iconSeparator) {
            imageMode = !imageMode
            continue
        }
        
        if (imageMode) {
            text = text + Text("\(Image(systemName: splitInput[index]))")
            continue
        }
        
        text = text + Text(splitInput[index])
    }
    
    return text
}
    

#Preview {
    VStack {
        EVYText("::star.square.on.square.fill::")
        EVYText("Just text")
        EVYText("::star.square.on.square.fill:: 88% - ::star.square.on.square.fill:: 4 items sold")
    }
}
