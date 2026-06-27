//
//  EVYPage.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import UIKit

private struct EVYDraftScopeEnvironmentKey: EnvironmentKey {
  static let defaultValue: String? = nil
}

extension EnvironmentValues {
  var evyDraftScopeId: String? {
    get { self[EVYDraftScopeEnvironmentKey.self] }
    set { self[EVYDraftScopeEnvironmentKey.self] = newValue }
  }
}

/// Renders a page by id, reading title/rowIds/footerRowId directly from the pages table.
struct EVYPage: View {
  let pageId: String

  @Environment(\.evyDraftScopeId) private var evyDraftScopeId
  @State private var pageReloadID = 0

  var body: some View {
    Group {
      if let page = EVYPageStore.page(id: pageId) {
        pageContent(page: page)
          .id(pageReloadID)
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: .evyDataChanged)) { notification in
      guard
        let change = notification.userInfo?[EVYDataChange.userInfoKey] as? EVYDataChange,
        change.namespace == EVYNamespace.evy,
        change.resource == EVYCoreResource.pages.rawValue,
        change.id == pageId
      else { return }
      pageReloadID += 1
    }
  }

  @ViewBuilder
  private func pageContent(page: EVYStoredPage) -> some View {
    VStack {
      mainContent(rowIds: page.rowIds)
      footerContent(footerRowId: page.footerRowId)
    }
    .navigationTitle("")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .principal) {
        EVYTextView(page.title ?? "", style: .title)
          .lineLimit(1)
          .truncationMode(.tail)
          .accessibilityIdentifier("pageTitle_\(pageId)")
      }
    }
    .onAppear {
      EVY.activeCacheScopeId = pageId
      EVY.draftStore.activeScopeId = evyDraftScopeId
      bootstrapDrafts(pageId: pageId, scopeId: evyDraftScopeId)
    }
    .simultaneousGesture(
      TapGesture().onEnded {
        UIApplication.shared.sendAction(
          #selector(UIResponder.resignFirstResponder),
          to: nil,
          from: nil,
          for: nil
        )
      })
  }

  @ViewBuilder
  private func mainContent(rowIds: [String]) -> some View {
    ScrollView {
      ForEach(rowIds, id: \.self) { rowId in
        EVYRow(rowId: rowId)
          .padding(.vertical, Constants.minorPadding)
      }
    }
    .accessibilityIdentifier("page_\(pageId)")
  }

  @ViewBuilder
  private func footerContent(footerRowId: String?) -> some View {
    if let footerRowId {
      EVYRow(rowId: footerRowId)
        .overlay(
          alignment: .top,
          content: {
            Rectangle()
              .fill(Constants.borderColor)
              .frame(height: 1)
              .padding(.top, -Constants.minorPadding)
          }
        )
        .accessibilityIdentifier("pageFooter_\(pageId)")
    }
  }

  @MainActor
  private func bootstrapDrafts(pageId: String, scopeId: String?) {
    forEachStoredRow(inPageId: pageId) { storedRow in
      guard let contentRow = storedRow.uiRow() else { return }
      bootstrapRowDraft(row: contentRow, scopeId: scopeId)
    }
  }
}
