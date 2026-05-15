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

extension UI_Page: View {
  public var body: some View {
    EVYPageBody(page: self)
  }
}

private struct EVYPageBody: View {
  let page: UI_Page
  @Environment(\.evyDraftScopeId) private var evyDraftScopeId

  var body: some View {
    pageContent
      .onAppear {
        EVY.activeCacheScopeId = page.id
        EVY.draftStore.activeScopeId = evyDraftScopeId
        bootstrapDrafts(in: page, scopeId: evyDraftScopeId)
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
  private var pageContent: some View {
    VStack {
      mainContent
      footerContent
    }
    .navigationTitle(page.title)
    .navigationBarTitleDisplayMode(.inline)
  }

  @ViewBuilder
  private var mainContent: some View {
    ScrollView {
      ForEach(page.rows, id: \.id) { row in
        pageRow(row)
      }
    }
    .accessibilityIdentifier("page_\(page.id)")
  }

  @ViewBuilder
  private var footerContent: some View {
    if let footer = page.footer {
      EVYRow(row: footer)
        .overlay(
          alignment: .top,
          content: {
            Rectangle()
              .fill(Constants.borderColor)
              .frame(height: 1)
              .padding(.top, -Constants.minorPadding)
          }
        )
        .accessibilityIdentifier("pageFooter_\(page.id)")
    }
  }

  private func pageRow(_ row: UI_Row) -> some View {
    EVYRow(row: row)
      .padding(.horizontal, Constants.majorPadding)
      .padding(.vertical, Constants.minorPadding)
  }

  /// Ensures a draft exists for each row `destination` binding in the active scope.
  @MainActor
  private func bootstrapDrafts(in page: UI_Page, scopeId: String?) {
    forEachRow(in: page) { row in
      guard !row.destination.isEmpty else { return }
      let destinationProps = EVY.parsePropsFromText(row.destination)
      let variableName = parseFunctionCall(destinationProps)?.functionArgs ?? destinationProps
      guard !variableName.isEmpty else { return }
      let initialData: Data?
      if row.type == .inlinePicker {
        initialData = "[]".data(using: .utf8)
      } else if row.type == .calendar {
        initialData = {
          guard let json = try? EVY.publicStore.getJsonForBinding(key: "timeslots") else {
            return nil
          }
          return try? JSONEncoder().encode(json)
        }()
      } else {
        initialData = nil
      }
      EVY.ensureDraftExists(
        variableName: variableName,
        initialData: initialData,
        scopeId: scopeId
      )
    }
  }
}
