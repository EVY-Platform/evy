//
//  EVYInfoRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYInfoRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let text: String
    }
}

struct EVYInfoRow: View {
    public static var JSONType = "Info"
    
    private let view: EVYInfoRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYInfoRowView.self, forKey:.view)
    }
    
    var body: some View {
        EVYTextView(view.content.text, style: .info)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}



#Preview {
    let json =  SDUIConstants.infoRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
