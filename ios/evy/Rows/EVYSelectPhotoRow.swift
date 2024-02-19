//
//  EVYSelectPhotoRow.swift
//  evy
//
//  Created by Clemence Chalot on 18/02/2024.
//



import SwiftUI

struct EVYSelectPhotoRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let icon: String
        let subtitle: String
        let content: String
        let photo_ids: String
    }
}
    
struct EVYSelectPhotoRow: View {
    public static var JSONType = "SelectPhoto"
    
    private let view: EVYSelectPhotoRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSelectPhotoRowView.self, forKey:.view)
        _title = State(initialValue: self.view.content.icon)
    }
    
    @State private var title: String = ""
    
    var body: some View {
        GeometryReader { geometry in
            VStack {
                if (view.content.title.count > 0) {
                    EVYText(view.content.title)
                        .font(.titleFont)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, Constants.textLinePadding)
                };
                VStack {
                    EVYText(view.content.icon)
                        .font(.titleFont)
                        .foregroundColor(Constants.placeholderColor)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, Constants.majorPadding)
                    EVYText(view.content.subtitle)
                        .font(.titleFont)
                        .foregroundColor(Constants.placeholderColor)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.bottom, Constants.majorPadding)
                }
                .padding(.vertical, geometry.size.height * 0.07)
                .background(
                    RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                        .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth))
                
                EVYText(view.content.content)
                    .font(.detailFont)
                    .foregroundColor(Constants.placeholderColor)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, Constants.textLinePadding)
            }
        }
    }
}


#Preview {
    let json =  DataConstants.selectPhotoRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
