//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYTextRow: View {
    
    public static var JSONType = "Text"
    private struct JSONData: Decodable {
        let title: String
        let content: String
        let maxLines: String
    }
    
    private let title: String
    private let content: String
    private let maxLines: Int
    
    @State private var expanded: Bool = false
    @State private var truncated: Bool = false
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.title = parsedData.title
        self.content = parsedData.content
        self.maxLines = Int(parsedData.maxLines) ?? 2
    }
    private var moreLessText: String {
        if !truncated {
            return ""
        } else {
            return self.expanded ? "Read less" : "Read more"
        }
    }
        
    var body: some View {
        VStack {
            Text(title)
                .font(.titleFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
            Text(content)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
                .lineLimit(expanded ? nil : maxLines)
            Text(moreLessText)
                .foregroundStyle(.blue)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    Text(content).lineLimit(maxLines)
                        .background(GeometryReader { visibleTextGeometry in
                            Text(self.content)
                                .background(GeometryReader { fullTextGeometry in
                                    Color.clear.onAppear {
                                        self.truncated = fullTextGeometry.size.height > visibleTextGeometry.size.height
                                    }
                                })
                            .frame(height: .greatestFiniteMagnitude)
                        })
                        .hidden()
                )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        .onTapGesture {
            self.expanded.toggle()
        }
    }
}


#Preview {
    let json = """
    {
        "type": "Text",
        "content": {
            "maxLines": "2",
            "title": "Description",
            "content":
                "Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place. "
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
