//
//  EVYSelectRow.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSelect: View {
    let title: String
    let options: [String]
    
    @State private var selection: String?

    init(title: String, options: [String]) {
        self.title = title
        self.options = options
        
        _selection = State(initialValue: options[0])
    }
    
    var body: some View {
        VStack {
            EVYTextView(title)
                .frame(maxWidth: .infinity, alignment: .leading)
            List(selection: $selection) {
                ForEach(options, id: \.self) { value in
                    HStack {
                        EVYTextView(value)
                        Spacer()
                        EVYRadioButton(isSelected: value == selection)
                    }
                }
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
            }
        }
        .environment(\.defaultMinListRowHeight, 70)
        .listStyle(.inset)
    }
}


#Preview {
    let options = [
        "No longer used",
        "Moving out",
        "Doesn't fit"
    ]
    return EVYSelect(title: "Select", options: options)
}
