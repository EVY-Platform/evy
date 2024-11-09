//
//  EVYDropdown.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI
    
struct EVYDropdown: View {
    let title: String?
    let destination: String
    let format: String
    let placeholder: String?
    
    private var options: EVYJsonArray = []
    private var selection: EVYState<String>
    @State private var showSheet = false
    
    init(title: String?,
         placeholder: String?,
         data: String,
         format: String,
         destination: String)
    {
        self.title = title
        self.destination = destination
        self.format = format
        self.placeholder = placeholder
        
        do {
            let data = try EVY.getDataFromText(data)
            if case let .array(arrayValue) = data {
                options = arrayValue
            }
        } catch {}
        
        selection = EVYState(watch: destination, setter: {
            do {
                let value = try EVY.getDataFromText($0)
                return EVY.formatData(json: value, format: format)
            } catch {
                return ""
            }
        })
    }
    
    var body: some View {
        HStack {
            Button(action: { showSheet.toggle() }) {
                if selection.value.count > 0 {
                    EVYTextView(selection.value)
                } else {
					EVYTextView(placeholder ?? "", style: .info)
                }
            }
            Spacer()
            EVYTextView("::chevron.down::")
        }
		.buttonStyle(.plain)
        .padding(EdgeInsets(top: Constants.fieldPadding,
                            leading: Constants.minorPadding,
                            bottom: Constants.fieldPadding,
                            trailing: Constants.minorPadding))
        .background(
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth)
                .opacity(Constants.borderOpacity)
        )
        .contentShape(Rectangle())
        .onTapGesture { showSheet.toggle() }
        .sheet(isPresented: $showSheet, content: {
            VStack {
                if title?.count ?? 0 > 0 {
                    EVYTextView(title!).padding(.top, Constants.majorPadding)
                }
                EVYSelectList(options: options,
                              format: format,
                              destination: destination)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        })
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.syncData()
		try! await EVY.createItem()
		return Group {
			EVYDropdown(title: "Dropdown",
						placeholder: "A placeholder",
						data: "{conditions}",
						format: "{$0.value}",
						destination: "{item.condition_id}")
		}
	}
}
