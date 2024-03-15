//
//  EVYSelectRow.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSelectRowView: Decodable {
    let content: ContentData

    struct ContentData: Decodable {
        let title: String
        let value: String
        let placeholder: String
    }
}

struct EVYSelectRow: View {
    public static var JSONType = "Select"
    private let view: EVYSelectRowView
    
    @State private var selection: String?
    // Will need to be updated with data values
    private let reasons = [
        "No longer used",
        "Moving out",
        "Doesn't fit"
    ]

    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSelectRowView.self, forKey:.view)
        _selection = State(initialValue: reasons[0])
    }
    
    var body: some View {
        VStack {
            EVYText(view.content.title)
                .font(.titleFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)
            List(selection: $selection) {
                ForEach(reasons, id: \.self) { value in
                    HStack {
                        Text(value).font(.detailFont)
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
    let data = EVYData.shared
    let item = DataConstants.item.data(using: .utf8)!
    try! data.set(name: "item", data: item)
    let json =  SDUIConstants.selectRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
