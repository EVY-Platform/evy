//
//  EVYFlow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

extension UI_Flow {
	func getPageById(_ id: String) -> UI_Page? {
		pages.first { $0.id == id }
	}
}
