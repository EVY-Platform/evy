//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYTextRowView: Codable {
    let content: ContentData
    let max_lines: String
    
    struct ContentData: Codable {
        let title: String
        let text: String
    }
}

struct EVYTextRow: View, EVYRowProtocol {
    public static let JSONType = "Text"
    
    private let view: EVYTextRowView
    @State private var showSheet = false
	@State private var canBeExpanded: Bool = false
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYTextRowView.self, forKey:.view)
    }
	
	init(from decoder: Decoder) throws {
		let container = try decoder.container(keyedBy: RowCodingKeys.self)
		try self.init(container: container)
	}
	
	func encode(to encoder: Encoder) throws {
		var container = encoder.container(keyedBy: RowCodingKeys.self)
		try container.encode(view, forKey: .view)
	}
    
    var body: some View {
        VStack(alignment:.leading) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .padding(.vertical, Constants.padding)
            }
            EVYTextView(view.content.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(Int(view.max_lines) ?? 1)
                .background {
                    ViewThatFits(in: .vertical) {
                        EVYTextView(view.content.text).hidden()
                        Color.clear.onAppear {
                            canBeExpanded = true
                        }
                    }
                }
                .sheet(isPresented: $showSheet, content: {
                    EVYTextView(view.content.text)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.top, Constants.majorPadding)
                    .presentationDragIndicator(.visible)
                })
            if canBeExpanded {
				EVYTextView("Read more", style: .action)
                    .padding(.vertical, Constants.padding)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if canBeExpanded {
                showSheet.toggle()
            }
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["0","pages","0","rows", "0"])
	}
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["0","pages","0","rows", "0"])
	}
}
