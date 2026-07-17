//
//  EVYPage.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import UIKit

/// Renders a page by id, reading title/rowIds/footerRowId directly from the pages table.
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
      mainContent(rowIds: page.rowIds)
      footerContent(footerRowId: page.footerRowId)
    }
    .evyNavigationTitle(page.title ?? "", accessibilityIdentifier: "pageTitle_\(pageId)")
    .onAppear {
      activatePageScope()
    }
    .onChange(of: page.rowIds) { _, _ in
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

  /// Re-establishes this page's cache/draft scope as the active one and refreshes its rows.
  ///
  /// `EVYState` reads resolve drafts through the global `activeScopeId`, which only reflects
  /// the most recently appeared page. A row added to this page while another page was active
  /// (e.g. via a WebSocket SDUI update while navigated away) would have initialised against
  /// the wrong scope. Re-asserting the scope and broadcasting a recompute makes every row on
  /// this page re-resolve against the correct scope when it (re)appears or its rows change.
  @MainActor
  private func activatePageScope() {
    EVY.activeCacheScopeId = pageId
    EVY.draftStore.activeScopeId = effectiveDraftScopeId
    bootstrapDrafts(pageId: pageId, scopeId: effectiveDraftScopeId)
    EVYValueChange.post(key: nil)
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
