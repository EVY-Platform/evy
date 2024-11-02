//
//  EVYSearchView.swift
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
    let format: String
    
    init(source: String,
         destination: String,
         placeholder: String,
         format: String)
    {
        self.source = source
        self.destination = destination
        self.placeholder = placeholder
        self.format = format
        
        do {
            let data = try EVY.getDataFromText(destination)
            if case .array(_) = data {
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
            EVYSearchMultiple(source: source,
                              format: format,
                              destination: destination,
                              placeholder: placeholder)
        } else {
            EVYSearchSingle(source: source,
                            format: format,
                            destination: destination,
                            placeholder: placeholder)
        }
    }
}
