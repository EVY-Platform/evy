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
        Group {
            ScrollView {
                ForEach(page.rows, id: \.id) { row in
                    EVYRow(row: row)
                        .padding(.horizontal, Constants.majorPadding)
                        .padding(.vertical, Constants.minorPadding)
                }
            }
            .navigationTitle(page.title)
            .accessibilityIdentifier("page_\(page.id)")
            if let footer = page.footer {
                EVYRow(row: footer)
                    .overlay(alignment: .top, content: {
                        Rectangle()
                            .fill(Constants.borderColor)
                            .frame(height: 1)
                            .padding(.top, -Constants.minorPadding)
                    })
                    .accessibilityIdentifier("pageFooter_\(page.id)")
            }
        }
        .onAppear {
            EVY.data.activeDraftScopeId = evyDraftScopeId
            bootstrapDrafts(in: page, scopeId: evyDraftScopeId)
        }
        .simultaneousGesture(TapGesture().onEnded {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil,
                from: nil,
                for: nil
            )
        })
    }

    /// Ensures a draft exists for each row `destination` binding in the active scope.
    @MainActor
    private func bootstrapDrafts(in page: UI_Page, scopeId: String?) {
        forEachRow(in: page) { row in
            guard !row.destination.isEmpty else { return }
            let variableName = parsePropsFromText(row.destination)
            guard !variableName.isEmpty else { return }
            let initialData: Data?
            if row.type == .inlinePicker {
                initialData = "[]".data(using: .utf8)
            } else if row.type == .calendar {
                initialData = try? EVY.data.getForBinding(key: "timeslots").data
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
