//
//  EVYSelectPhotoRow.swift
//  evy
//
//  Created by Clemence Chalot on 18/02/2024.
//


import SwiftUI
import PhotosUI

struct EVYSelectPhotoRowView: Codable {
    let content: ContentData
    
    struct ContentData: Codable {
        let title: String
        let icon: String
        let subtitle: String
        let content: String
        let photos: String
    }
}

struct EVYSelectPhotoRow: View, EVYRowProtocol {
    public static let JSONType = "SelectPhoto"
    
    private let view: EVYSelectPhotoRowView
    private let edit: SDUI.Edit

    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(EVYSelectPhotoRowView.self, forKey:.view)
        edit = try container.decode(SDUI.Edit.self, forKey:.edit)
    }
	
	func complete() -> Bool {
		if !edit.validation.required {
			return true
		}
		
		return view.content.photos.count >= edit.validation.minAmount ?? 1
	}
	
	func incompleteMessages() -> [String] {
		edit.validation.message != nil ? [edit.validation.message!] : []
	}

    var body: some View {
        EVYSelectPhoto(title: view.content.title,
                       subtitle: view.content.subtitle,
                       icon: view.content.icon,
                       content: view.content.content,
                       data: view.content.photos,
                       destination: edit.destination!)
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","0","rows", "0"])
	}
}
