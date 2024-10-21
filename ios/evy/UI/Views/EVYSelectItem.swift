//
//  EVYSelectItem.swift
//  evy
//
//  Created by Geoffroy Lesage on 19/9/2024.
//

import SwiftUI

public enum EVYSelectItemTarget: String {
    case single_identifier
    case single_value
    case single_bool
    case single_object
    case multi_identifier
    case multi_value
    case multi_object
}

struct EVYSelectItem: View {
    let destination: String
    let value: EVYJson
    let format: String
    let selectionStyle: EVYRadioStyle
    let target: EVYSelectItemTarget
    let textStyle: EVYTextStyle
    
    private var selected: EVYState<Bool>
    
    init(destination: String,
         value: EVYJson,
         format: String,
         selectionStyle: EVYRadioStyle,
         target: EVYSelectItemTarget,
         textStyle: EVYTextStyle = .body)
    {
        self.destination = destination
        self.value = value
        self.format = format
        self.selectionStyle = selectionStyle
        self.target = target
        self.textStyle = textStyle
        
        self.selected = EVYState(watch: destination, setter: {
            do {
                if target == .single_identifier {
                    let sourceId = value.identifierValue()
                    let destinationId = try EVY.getDataFromText($0).identifierValue()
                    return sourceId == destinationId
                } else if target == .single_value {
                    let sourceString = value.toString()
                    let destinationString = try EVY.getDataFromText($0).toString()
                    return sourceString == destinationString
                } else if target == .single_bool {
                    return try EVY.evaluateFromText($0)
                } else if target == .single_object {
                    let existingData = try EVY.getDataFromText(destination)
                    return existingData.identifierValue() == value.identifierValue()
                } else if target == .multi_identifier {
                    let existingData = try EVY.getDataFromText(destination)
                    guard case let .array(arrayValue) = existingData else {
                        return false
                    }
                    let valueId = value.identifierValue()
                    return arrayValue.contains {
                        $0.identifierValue() == valueId
                    }
                } else if target == .multi_value {
                    let existingData = try EVY.getDataFromText(destination)
                    guard case let .array(arrayValue) = existingData else {
                        return false
                    }
                    let valueString = value.toString()
                    return arrayValue.contains {
                        $0.toString() == valueString
                    }
                } else if target == .multi_object {
                    let existingData = try EVY.getDataFromText(destination)
                    guard case let .array(arrayValue) = existingData else {
                        return false
                    }
                    let valueId = value.identifierValue()
                    return arrayValue.contains {
                        $0.identifierValue() == valueId
                    }
                }
            } catch {}
            
            return false
        })
    }
    
    var body: some View {
        HStack {
            let text = EVY.formatData(json: value, format: format)
            EVYTextView(text, style: textStyle)
                .frame(maxWidth: .infinity, alignment: .leading)
            EVYRadioButton(isSelected: selected.value, style: selectionStyle)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            do {
                if target == .single_identifier
                    || target == .single_value
                    || target == .single_bool
                    || target == .single_object
                {
                    var newValue = ""
                    switch target {
                    case .single_identifier:
                        if !selected.value {
                            newValue = value.identifierValue()
                        }
                    case .single_bool:
                        newValue = selected.value ? "false" : "true"
                    default:
                        if !selected.value {
                            newValue = value.toString()
                        }
                    }
                    try EVY.updateValue(newValue, at: destination)
                } else {
                    let existingData = try EVY.getDataFromText(destination)
                    guard case let .array(arrayValue) = existingData else {
                        return
                    }
                    
                    if target == .multi_identifier {
                        let valueId = value.identifierValue()
                        var updatedData = arrayValue.filter {
                            $0.identifierValue() != valueId
                        }.map {
                            $0.toString()
                        }
                        if updatedData.count == arrayValue.count {
                            updatedData.append(value.identifierValue())
                        }
                        let encoded = try JSONEncoder().encode(updatedData)
                        try EVY.updateData(encoded, at: destination)
                    } else if target == .multi_value {
                        let valueString = value.toString()
                        var updatedData = arrayValue.filter {
                            $0.toString() != valueString
                        }
                        if updatedData.count == arrayValue.count {
                            updatedData.append(value)
                        }
                        let encoded = try JSONEncoder().encode(updatedData)
                        try EVY.updateData(encoded, at: destination)
                    } else if target == .multi_object {
                        let valueId = value.identifierValue()
                        var updatedData = arrayValue.filter {
                            $0.identifierValue() != valueId
                        }
                        if updatedData.count == arrayValue.count {
                            updatedData.append(value)
                        }
                        let encoded = try JSONEncoder().encode(updatedData)
                        try EVY.updateData(encoded, at: destination)
                    }
                }
                
            } catch {}
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let selling_reasons = DataConstants.selling_reasons.data(using: .utf8)!
    try! EVY.data.create(key: "selling_reasons", data: selling_reasons)
    
    let options = try! EVY.getDataFromText("{selling_reasons}")
    switch options {
    case .array(let arrayValue):
        return EVYSelectList(options: arrayValue,
                             format: "{$0.value}",
                             destination: "{item.selling_reason_id}")
    default:
        return Text("error")
    }
}
