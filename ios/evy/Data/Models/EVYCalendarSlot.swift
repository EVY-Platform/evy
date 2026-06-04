//
//  EVYCalendarSlot.swift
//  evy
//

struct EVYCalendarSlot: Equatable {
  let dateTimeISO: String
  let x: Int
  let y: Int
  let header: String
  let timeLabel: String
  let isPrimarySelected: Bool
  let isSecondarySelected: Bool
}
