//
//  EVYMapView.swift
//  frodo
//
//  Created by Clemence Chalot on 20/12/2023.
//

import SwiftUI
import MapKit


struct EVYMapView: View {
    let location: CLLocationCoordinate2D

    var body: some View {
        Map{
            Marker("location", coordinate: location)
        }
        .mapStyle(.standard(elevation: .realistic))
        .cornerRadius(Constants.mainCornerRadius)
        .padding(.bottom, Constants.majorPadding)
    }
}

#Preview {
    EVYMapView(location: CLLocationCoordinate2D(latitude: -33.91514116915074, longitude: 151.20676069630827))
}
