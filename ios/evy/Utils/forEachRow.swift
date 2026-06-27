//
//  forEachRow.swift
//  evy
//

import Foundation

func forEachRow(in page: UI_Page, visitor: (UI_Row) -> Void) {
  for row in page.rows {
    visit(row, visitor: visitor)
  }
  if let footer = page.footer {
    visit(footer, visitor: visitor)
  }
}

private func visit(_ row: UI_Row, visitor: (UI_Row) -> Void) {
  visitor(row)
  for child in row.children ?? [] {
    visit(child, visitor: visitor)
  }
  if let child = row.child {
    visit(child, visitor: visitor)
  }
}
