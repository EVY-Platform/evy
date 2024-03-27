//
//  EVYDropdownRow.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

struct EVYDropdownRowView: Decodable {
    let content: ContentData
    let data: String
    
    struct ContentData: Decodable {
        let title: String
        let value: String
        let placeholder: String
    }
}
    
struct EVYDropdownRow: View {
    public static var JSONType = "Dropdown"
    
    private let view: EVYDropdownRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYDropdownRowView.self, forKey:.view)
    }
    
    @State private var showSheet = false
    
    var body: some View {
        VStack {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .font(.evy)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Constants.minorPadding)
            }
            Button(action: { showSheet.toggle() }) {
                if (view.content.value.count > 0) {
                    EVYTextView(view.content.value)
                        .font(.evy)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, Constants.minorPadding)
                }
                HStack {
                    EVYTextView(view.content.placeholder)
                        .font(.evy)
                        .foregroundColor(Constants.placeholderColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, Constants.minorPadding)
                    Spacer()
                    EVYTextView.parsedText("::chevron.down::")
                        .foregroundColor(.black)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                        .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth))
            }
        }
        .sheet(isPresented: $showSheet, content: {
            VStack {
                if (view.content.title.count > 0) {
                    EVYTextView(view.content.title)
                        .font(.evy)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 30)
                }
                EVYSelect(options: ["No longer used",
                                    "Moving out",
                                    "Doesn't fit"])
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                
            }
        })
    }
}


#Preview {
    let json =  SDUIConstants.dropdownRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
