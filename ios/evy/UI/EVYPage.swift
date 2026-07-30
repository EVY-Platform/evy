//
//  EVYPage.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import UIKit

/// Renders a page by id, reading title/row_ids/footer_row_id directly from the pages table.
struct EVYPage: View {
  let pageId: String

  @Environment(\.evyScope) private var evyScope
  @State private var page: EVYStoredPage?

  init(pageId: String) {
    self.pageId = pageId
    _page = State(initialValue: EVYPageStore.page(id: pageId))
  }

  var body: some View {
    Group {
      if let page {
        pageContent(page: page)
      }
    }
    .onEVYRecordChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.pages.rawValue,
      id: pageId
    ) {
      let latestPage = EVYPageStore.page(id: pageId)
      if page != latestPage {
        page = latestPage
      }
    }
  }

  @ViewBuilder
  private func pageContent(page: EVYStoredPage) -> some View {
    VStack {
      mainContent(row_ids: page.row_ids)
      footerContent(footer_row_id: page.footer_row_id)
    }
    .evyNavigationTitle(page.title ?? "", accessibilityIdentifier: "pageTitle_\(pageId)")
    .onAppear {
      activatePageScope()
    }
    .onChange(of: page.row_ids) { _, _ in
      // Newly added rows on the foreground page already resolve against the correct global
      // scope; just make sure their drafts are bootstrapped. Deliberately does not reassert
      // the global scope, so a backgrounded page whose rows change cannot steal it.
      bootstrapDrafts(pageId: pageId, scopeId: effectiveDraftScopeId)
    }
    .simultaneousGesture(
      TapGesture().onEnded {
        UIApplication.shared.sendAction(
          #selector(UIResponder.resignFirstResponder),
          to: nil,
          from: nil,
          for: nil
        )
      }
    )
    .environment(\.evyScope, EVYScope(cacheScopeId: pageId, draftScopeId: effectiveDraftScopeId))
  }

  /// The draft scope this page reads and writes against. Create/edit flows keep their
  /// entity scope so drafts merge on submit; every other page falls back to a per-page
  /// ephemeral scope so loose variables are shared between its rows.
  private var effectiveDraftScopeId: String {
    if let draftScopeId = evyScope.draftScopeId,
      EVYDraft.Scope.entityKey(fromScopeId: draftScopeId) != nil
    {
      return draftScopeId
    }
    return EVYDraft.ephemeralScopeId(forPageId: pageId)
  }

  /// Re-establishes this page's cache/draft scope as the active one, bootstraps its drafts
  /// and refreshes its rows.
  ///
  /// Rows now carry their scope as a value, so this no longer exists to repair rows that
  /// initialised against the wrong page. It remains because the globals are still the
  /// fallback for everything with no scope of its own - action execution and mutations -
  /// and because appearing is when this page's drafts must exist and its rows must re-read.
  @MainActor
  private func activatePageScope() {
    EVY.activeCacheScopeId = pageId
    EVY.draftStore.activeScopeId = effectiveDraftScopeId
    bootstrapDrafts(pageId: pageId, scopeId: effectiveDraftScopeId)
    EVYValueChange.post(key: nil)
  }

  @ViewBuilder
  private func mainContent(row_ids: [String]) -> some View {
    ScrollView {
      ForEach(row_ids, id: \.self) { rowId in
        EVYRow(rowId: rowId)
          .padding(.vertical, Constants.minorPadding)
      }
    }
    .accessibilityIdentifier("page_\(pageId)")
  }

  @ViewBuilder
  private func footerContent(footer_row_id: String?) -> some View {
    if let footer_row_id {
      EVYRow(rowId: footer_row_id)
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
