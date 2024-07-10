//
//  EVYCalendarTimeslotData.swift
//  evy
//
//  Created by Geoffroy Lesage on 10/7/2024.
//

public struct EVYCalendarTimeslotData: Decodable {
    let x: Int
    let y: Int
    let header: String
    let start_label: String
    let end_label: String
    let selected: Bool
}
