//
//  EVYSearchView.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYSearch: View {
    @ObservedObject var searchController: EVYSearchController
    private var canSelectMultiple = false
    
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
                self.canSelectMultiple = true
            }
        } catch {}
        
        self.searchController = EVYSearchController(source: source, format: format)
    }
    
    var body: some View {
        if canSelectMultiple {
            EVYSearchMultiple(searchController: searchController,
                              destination: destination,
                              placeholder: placeholder,
                              format: format)
        } else {
            EVYSearchSingle(searchController: searchController,
                            destination: destination,
                            placeholder: placeholder)
        }
    }
}
