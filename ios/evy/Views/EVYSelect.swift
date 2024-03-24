//
//  EVYSelectRow.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSelect: View {
    let options: [String]
    
    @State private var selection: String?

    init(options: [String]) {
        self.options = options
        
        _selection = State(initialValue: options[0])
    }
    
    var body: some View {
        VStack {
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
    return EVYSelect(options: options)
}
