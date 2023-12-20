//
//  EVYAddressRow.swift
//  frodo
//
//  Created by Clemence Chalot on 17/12/2023.
//

import SwiftUI
import MapKit

public struct EVYLocation: Decodable {
    let latitude: Float
    let longitude: Float
}

struct EVYAddressRow: View {
        public static var JSONType = "Address"
        private struct JSONData: Decodable {
            let title: String
            let line_1: String
            let line_2: String
            let location: EVYLocation
        }
        private let title: String
        private let line1: String
        private let line2: String
        private let location: EVYLocation
    
        init(container: KeyedDecodingContainer<CodingKeys>) throws {
            let parsedData = try container.decode(JSONData.self, forKey:.content)
            self.title = parsedData.title
            self.line1 = parsedData.line_1
            self.line2 = parsedData.line_2
            self.location = parsedData.location
        }
    
    var body: some View {
        VStack {
            EVYText(title)
                .font(.titleFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
            EVYMapView(location: CLLocationCoordinate2D(latitude: CLLocationDegrees(location.latitude), longitude: CLLocationDegrees(location.longitude)))
                .frame(height: 180)
            EVYText(line1)
                .foregroundStyle(.gray)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
            EVYText(line2)
                .foregroundStyle(.gray)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.minorPadding)
        }
    }
}

#Preview {
    let json = """
    {
        "type": "Address",
        "content": {
            "title": "Pickup location",
            "line_1": "23-25 Rosebery Avenue",
            "line_2": "2018 Rosebery, NSW",
            "location": {
                "latitude": -33.91514116915074,
                "longitude": 151.20676069630827
            }
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
