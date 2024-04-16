//
//  EVYHorizontalSelection.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYHorizontalSelection: View {
    @ObservedObject var searchController: EVYSearchAPI
    
    var body: some View {
        ScrollView(.horizontal, content: {
            HStack {
                ForEach(searchController.selected, id: \.id) { result in
                    EVYTextView("::checkmark:: \(result.title)")
                        .padding(Constants.minorPadding)
                        .background(Color(.gray).opacity(0.3),
                                    in: RoundedRectangle(cornerRadius: 5.0, style: .continuous))
                        .onTapGesture {
                            searchController.unselect(result)
                        }
                }
            }
        })
    }
}

#Preview {
    @ObservedObject var searchController = EVYSearchAPI()
    return EVYHorizontalSelection(searchController: searchController)
}
