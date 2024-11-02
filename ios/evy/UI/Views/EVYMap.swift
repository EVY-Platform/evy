//
//  EVYMap.swift
//  evy
//
//  Created by Clemence Chalot on 20/12/2023.
//

import SwiftUI
import MapKit

struct EVYMap: View {
    let location: CLLocationCoordinate2D
    let markerLabel: String

    var body: some View {
        let span = MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        let region = MKCoordinateRegion(center: location, span: span)
        Map(initialPosition: .region(region)) {
            Marker(markerLabel, coordinate: location)
        }
        .mapStyle(.standard(elevation: .realistic))
        .cornerRadius(Constants.mainCornerRadius)
    }
}

#Preview {
    let testLocation = CLLocationCoordinate2D(latitude: -33.91514116915074,
                                              longitude: 151.20676069630827)
    return EVYMap(location: testLocation, markerLabel: "Rosebery")
}
