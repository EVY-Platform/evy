//
//  EVYFlow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

extension SDUI_Flow {
	func getPageById(_ id: String) -> SDUI_Page? {
		pages.first { $0.id == id }
	}
}
