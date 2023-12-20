//
//  EVYTitleRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public struct EVYPaymentOption: Decodable {
    let icon: String
    let label: String
    let disclaimer: String
}

struct EVYPaymentOptionView: View {
    let option: EVYPaymentOption
    let hasDisclaimer: Bool
    
    init(_ option: EVYPaymentOption) {
        self.option = option
        self.hasDisclaimer = option.disclaimer.count > 0
    }
    
    var body: some View {
        switch hasDisclaimer {
        case true:
            HStack {
                Image(systemName: option.icon)
                EVYText(option.label)
                EVYGreyedBackgound(content: HStack {
                    EVYText(option.disclaimer)
                    Spacer()
                }, padding: Constants.minorPadding)
            }
        default:
            HStack {
                Image(systemName: option.icon)
                EVYText(option.label)
                Spacer()
            }.padding(.top, Constants.minorPadding)
        }
    }
}

struct EVYPaymentOptionsRow: View {
    public static var JSONType = "PaymentOptions"
    private struct JSONData: Decodable {
        let title: String
        let options: [EVYPaymentOption]
    }
    
    private let title: String
    private let optionViews: [EVYPaymentOptionView]
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.title = parsedData.title
        self.optionViews = parsedData.options.map { EVYPaymentOptionView($0) }
    }
    
    var body: some View {
        VStack{
            VStack {
                EVYText(title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, Constants.minorPadding)
                ForEach(optionViews.indices, id: \.self) { index in
                    optionViews[index].padding(.bottom, Constants.minorPadding)
                }
            }
            .padding(.bottom, Constants.majorPadding)
        }
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        .padding()
    }
}

#Preview {
    let json = """
    {
        "type": "PaymentOptions",
        "content": {
            "title": "Payment methods accepted",
            "options": [
                {
                    "icon": "creditcard",
                    "label": "Card",
                    "disclaimer": "::lock:: EVY buyer protection",
                },
                {
                    "icon": "building.columns",
                    "label": "Bank",
                    "disclaimer": "::lock:: EVY buyer protection",
                },
                {
                    "icon": "dollarsign.square",
                    "label": "Cash",
                    "disclaimer": "",
                }
            ]
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
