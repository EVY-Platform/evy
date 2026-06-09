//
//  EVYMap.swift
//  evy
//

import MapKit
import SwiftUI

struct EVYMap: View {
  let title: String
  let location: EVYJson
  let subtitle: String

  private var coordinate: CLLocationCoordinate2D? {
    location.locationCoordinate()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: Constants.padding) {
      if !title.isEmpty {
        EVYRowTitle(title: title)
      }
      mapContent
      if !subtitle.isEmpty {
        EVYTextView(subtitle, style: .info)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }

  @ViewBuilder
	private var mapContent: some View {
    if let coordinate {
      Map(initialPosition: .region(region(for: coordinate))) {
        Marker(title.isEmpty ? "Location" : title, coordinate: coordinate)
      }
      .frame(maxWidth: .infinity)
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
    title: "Pickup location",
    location: .dictionary(["latitude": .decimal(-33.8688), "longitude": .decimal(151.2093)]),
    subtitle: "Meet near the main entrance"
  )
}
