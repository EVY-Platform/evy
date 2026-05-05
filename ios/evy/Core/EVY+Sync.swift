//
//  EVY+Sync.swift
//  evy
//

import Foundation

extension EVY {
  static func getUserData() throws {
    let userData = try EVYJson.from(localJSON: "user_data")
    let encodedUserData = try JSONEncoder().encode(userData)
    do {
      try EVY.publicStore.create(key: "user", data: encodedUserData)
    } catch EVYDataError.keyAlreadyExists {
      // Expected when startup bootstrapping runs after user data already exists.
    }
  }

  static func syncServiceData(service: String) async throws {
    let lastSyncTime =
      EVY.publicStore.oldestLastSyncedAt(keyPrefix: "\(service):")
      ?? "1970-01-01T00:00:00.000Z"
    let params = SyncServiceDataParams(
      service: service,
      lastSyncTime: lastSyncTime
    )
    let response = try await EVYAPIManager.shared.fetch(
      method: "syncServiceData",
      params: params,
      expecting: SyncServiceDataResponse.self
    )

    for row in response.data {
      let key = "\(row.service):\(row.resource)"
      let encoded = try JSONEncoder().encode(row.value)
      try publicStore.upsert(key: key, value: encoded)
    }
  }

  static func syncAllServices() async throws {
    // Fetch resource mapping (always fetches from server)
    try await fetchResourceMapping()

    for service in syncableServices {
      try await syncServiceData(service: service)
    }
  }
}
