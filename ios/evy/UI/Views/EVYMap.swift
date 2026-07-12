//
//  EVYMap.swift
//  evy
//

import MapKit
import SwiftUI

struct EVYMap: View {
  let location: EVYJson

  private var coordinate: CLLocationCoordinate2D? {
    location.locationCoordinate()
  }

  @ViewBuilder
  var body: some View {
    if let coordinate {
      Map(initialPosition: .region(region(for: coordinate))) {
        Marker("Location", coordinate: coordinate)
      }
	  .frame(maxWidth: .infinity, maxHeight: 150)
      .aspectRatio(4 / 3, contentMode: .fit)
      .clipShape(RoundedRectangle(cornerRadius: Constants.mainCornerRadius))
    } else {
      VStack(spacing: Constants.padding) {
        Image(systemName: "mappin.circle.fill")
          .font(.system(size: 32))
          .foregroundStyle(Constants.textGreyColor)
        EVYTextView("Location unavailable", style: .info)
      }
      .frame(maxWidth: .infinity)
      .aspectRatio(4 / 3, contentMode: .fit)
      .background(Constants.inactiveBackground)
      .clipShape(RoundedRectangle(cornerRadius: Constants.mainCornerRadius))
    }
  }

  private func region(for coordinate: CLLocationCoordinate2D) -> MKCoordinateRegion {
    MKCoordinateRegion(
      center: coordinate,
      span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
    )
  }
}

#Preview {
  EVYMap(
    location: .dictionary([
      "unit": .string("C509"),
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "country": .string("Australia"),
      "latitude": .string("-33.8688"),
      "longitude": .string("151.2093"),
    ])
  )
}
