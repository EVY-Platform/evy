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
        let photos: String
    }
}
    
struct EVYSelectPhotoRow: View {
    public static var JSONType = "SelectPhoto"
    
    private let view: EVYSelectPhotoRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSelectPhotoRowView.self, forKey:.view)
    }
        
    var body: some View {
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
                EVYText(view.content.subtitle)
                    .font(.titleFont)
                    .foregroundColor(Constants.placeholderColor)
            }
            .padding(.vertical, 80)
            .frame(maxWidth: .infinity, alignment: .center)
            .background(
                RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                    .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth))
            
            EVYText(view.content.content)
                .font(.detailFont)
                .foregroundColor(Constants.placeholderColor)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}


#Preview {
    let json =  SDUIConstants.selectPhotoRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
