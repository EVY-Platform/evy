//
//  AppConstants.swift
//  EVY
//
//  Created by Clemence Chalot on 11/12/2023.
//

import SwiftUI

extension Font {
    static let evy = Font.custom("SF Pro", size: 15)
    static let button = Font.custom("SF Pro", size: 24)
}

struct Constants {
    static let spacing = 4.0
    static let padding = 4.0
    
    static let majorPadding: CGFloat = 16
    static let minorPadding: CGFloat = 8
    static let minPading: CGFloat = 4
    
    static let borderWidth: CGFloat = 1.0
    
    static let mainCornerRadius: CGFloat = 10
    static let smallCornerRadius: CGFloat = 4

    static let buttonColor: Color = Color(#colorLiteral(red: 0.4745, green: 0.898, blue: 0.9569, alpha: 1))
    static let buttonDisabledColor: Color = Color(#colorLiteral(red: 0.6000000238, green: 0.6000000238, blue: 0.6000000238, alpha: 1))
    static let textButtonColor: Color = .blue
    static let inactiveBackground: Color = Color(#colorLiteral(red: 0.9621850848, green: 0.9621850848, blue: 0.9621850848, alpha: 1))
    static let fieldBorderColor: Color = Color(#colorLiteral(red: 0.2352934182, green: 0.2352946103, blue: 0.2610042691, alpha: 0.3))
    
    static let placeholderColor: Color = Color.gray
}

struct SDUIConstants {
    static let testRow = """
        {"type": "test"}
    """
    static let testButton = """
        {
            "type": "Button",
            "view": {
                "content": {
                    "title": "",
                    "label": "Start item creation"
                }
            },
            "action": {
                "target": "create_item:create_item_step_1"
            }
        }
    """
    static let testPage = """
        {
            "id": "home",
            "title": "Home",
            "rows": [\(testRow), \(testButton)]
        }
    """
    static let homeFlow = """
        {
            "id": "home",
            "name": "Home",
            "type": "read",
            "data": "item",
            "pages": [\(testPage)]
        }
    """
    
    static let flows = "[\(homeFlow), \(createItemFlow)]"
    static let createItemFlow = """
        {
            "id": "create_item",
            "name": "Create item",
            "type": "create",
            "data": "item",
            "pages": \(pages)
        }
    """
    
    static let pages = "[\(page), \(page2)]"
    static let page = """
        {
            "id": "create_item_step_1",
            "title": "Step 1",
            "rows": \(rows)
        }
    """
    
    static let rows = "[\(selectPhotoRow), \(dropdownRow), \(textAreaRow), \(textRow), \(columnContainerRow), \(sheetContainerRow), \(inputRow), \(inputPriceRow), \(columnContainerDimensionsRow), \(navigateButtonRow)]"
    
    static let sheetContainerRow = """
        {
           "type": "SheetContainer",
           "view": {
               "content": {
                   "title": "Address row",
                   "child": \(triggersSheetRow),
                   "children": [\(inputRow)]
               }
           }
        }
    """
    
    static let dropdownRow = """
        {
           "type": "Dropdown",
           "view": {
               "content": {
                   "title": "Selling Reason",
                   "value": "",
                   "placeholder": "Choose one"
               },
                "data": "{selling_reasons}"
           },
            "edit": {
                "destination": "{item.selling_reason}"
            }
        }
    """
    
    static let textAreaRow = """
        {
            "type": "TextArea",
            "view": {
                "content": {
                   "title": "Describe item",
                   "value": "{item.description}",
                   "placeholder": "Write a short description of your product"
                }
            }
        }
    """
    
    static let selectPhotoRow = """
        {
            "type": "SelectPhoto",
            "view": {
                "content": {
                    "title": "",
                    "icon": "::photo.badge.plus.fill::",
                    "subtitle": "Add photos",
                    "content": "Photos: {count(item.photos)}/10 - Chose your listing’s main photo first.",
                    "photos": "{item.photos}"
                }
            },
            "edit": {
                "destination": "{item.photos}",
                "minimum_amount": "1"
            }
        }
    """
    
    static let textRow = """
        {
            "type": "Text",
            "view": {
                "content": {
                    "title": "{item.title}",
                    "text": "Lorem Ipsum is simply ::star.square.on.square.fill:: dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
                },
                "max_lines": "2"
            }
        }
    """
    
    static let textRowNoTitle = """
        {
            "type": "Text",
            "view": {
                "content": {
                    "title": "",
                    "text": "Lorem Ipsum is simply ::star.square.on.square.fill:: dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum."
                },
                "max_lines": "2"
            }
        }
    """
    static let columnContainerRow = """
        {
            "type": "ColumnContainer",
            "view": {
                "content": {
                    "title": "Hello",
                    "children": [\(textRowNoTitle), \(textRowNoTitle)]
                }
            }
        }
    """
    static let inputRow = """
        {
            "type": "Input",
            "view": {
                "content": {
                    "title": "A row title ::star.square.on.square.fill::",
                    "value": "{item.title}",
                    "placeholder": "My iPhone ::star.square.on.square.fill:: 20"
                }
            },
            "edit": {
                "destination": "{item.title}",
                "minimum_characters": "6"
            }
        }
    """
    static let triggersSheetRow = """
        {
            "type": "Input",
            "view": {
                "content": {
                    "title": "Click me to open sheet",
                    "value": "{item.title}",
                    "placeholder": "My iPhone ::star.square.on.square.fill:: 20"
                }
            },
            "edit": {
                "destination": "{item.title}",
                "minimum_characters": "6"
            }
        }
    """
    
    static let inputPriceRow = """
        {
            "type": "Input",
            "view": {
                "content": {
                    "title": "Price",
                    "value": "{formatCurrency(item.price)}",
                    "placeholder": "{formatCurrency(item.price)}"
                }
            },
            "edit": {
                "destination": "{item.price}",
                "minimum_characters": "1"
            }
        }
    """
    
    static let columnContainerDimensionsRow = """
        {
            "type": "ColumnContainer",
            "view": {
                "content": {
                    "title": "Dimensions",
                    "children": [\(inputWidthRow), \(inputHeightRow), \(inputLengthRow)]
                }
            }
        }
    """
    
    static let inputWidthRow = """
        {
            "type": "Input",
            "view": {
                "content": {
                    "title": "",
                    "value": "{formatDimension(item.dimension.width)}",
                    "placeholder": "Width"
                }
            },
            "edit": {
                "destination": "{item.dimension.width}",
                "minimum_characters": "1"
            }
        }
    """
    
    static let inputHeightRow = """
        {
            "type": "Input",
            "view": {
                "content": {
                    "title": "",
                    "value": "{formatDimension(item.dimension.height)}",
                    "placeholder": "Height"
                }
            },
            "edit": {
                "destination": "{item.dimension.height}",
                "minimum_characters": "1"
            }
        }
    """
    
    static let inputLengthRow = """
        {
            "type": "Input",
            "view": {
                "content": {
                    "title": "",
                    "value": "{formatDimension(item.dimension.length)}",
                    "placeholder": "Length"
                }
            },
            "edit": {
                "destination": "{item.dimension.length}",
                "minimum_characters": "2"
            }
        }
    """
    
    static let navigateButtonRow = """
        {
            "type": "Button",
            "view": {
                "content": {
                    "title": "",
                    "label": "Next"
                }
            },
            "edit": {},
            "action": {
                "target": "create_item:create_item_step_2"
            }
        }
    """
    
    static let page2 = """
        {
            "id": "create_item_step_2",
            "title": "Step 2",
            "rows": \(rows2)
        }
    """
    static let rows2 = "[\(textRow), \(submitButtonRow)]"
    
    static let submitButtonRow = """
        {
            "type": "Button",
            "view": {
                "content": {
                    "title": "",
                    "label": "Submit"
                }
            },
            "edit": {},
            "action": {
                "target": "home:home"
            }
        }
    """
}

struct DataConstants {
    static let selling_reason = """
        {
            "id": "selling_reason",
            "value": "No longer used",
        }
    """
    static let selling_reasons = """
        [\(selling_reason),{
            "id": "76d781c6-7ab1-4b5e-99d5-60d417e3c385",
            "value": "Moving out",
        },{
            "id": "47e8131a-41ff-4f31-9da3-2bf2a09cd818",
            "value": "Doesn't fit",
        }]
    """
    static let conditions = """
        [{
            "id": "68e52916-7a07-4a07-ae0c-52e7800b9b9f",
            "value": "For parts",
        },{
            "id": "8e1cd2bf-d94f-4bb0-bd68-fc74434deabe",
            "value": "New",
        },{
            "id": "1eedac33-eb0b-4796-9853-50ad4036179f",
            "value": "Used - like new",
        },{
            "id": "69f25102-822c-436c-a6c1-3b49f887355e",
            "value": "Used - good",
        },{
            "id": "1e17474f-80d1-4081-8a64-79ebb3f60ab7",
            "value": "Used - fair",
        }]
    """
    static let provider = """
        {
            "id": "40041bb4-a6a1-468f-8864-972dba544793",
            "name": "Australia Post",
            "logo_id": "_image_id_",
            "cost": {
                "currency": "AUD",
                "value": 15.00
            },
        }
    """
    static let items = """
        [\(item),\(item)]
    """
    
    static let item = """
        {
            "id": "item",
            "title": "Amazing Fridge",
            "photos": [
                {
                    "id": "printer"
                },
                {
                    "id": "printer_logo"
                }
            ],
            "price": {
                "currency": "AUD",
                "value": "250"
            },
            "seller_id": "04b34671-4eeb-4f1c-8435-5e029a0e455c",
            "address": {
                "unit": "23-25",
                "street": "Rosebery Avenue",
                "city": "Rosebery",
                "postcode": "2018",
                "state": "NSW",
                "country": "Australia",
                "location": {
                    "latitude": "45.323124",
                    "longitude": "-3.424233"
                }
            },
            "created_timestamp": "1701471377",
            "transfer_options": {
                "pickup": {
                    "timeslots": [
                        {
                            "start_timestamp": "1700894934",
                            "end_timestamp": "1700895934",
                            "available": "true",
                            "type": "pickup"
                        },
                        {
                            "start_timestamp": "1700894934",
                            "end_timestamp": "1700895934",
                            "available": "false",
                            "type": "pickup"
                        },
                        {
                            "start_timestamp": "1700894934",
                            "end_timestamp": "1700895934",
                            "available": "true",
                            "type": "pickup"
                        }
                    ]
                },
                "delivery": {
                    "fee": {
                        "currency": "AUD",
                        "value": "5.00"
                    },
                    "timeslots": [
                        {
                            "start_timestamp": "1700894934",
                            "end_timestamp": "1700895934",
                            "available": "true",
                            "type": "delivery"
                        }
                    ]
                },
                "ship": {
                    "fee": {
                        "currency": "AUD",
                        "value": "10.00"
                    },
                    "transfer_provider_id": "40041bb4-a6a1-468f-8864-972dba544793"
                }
            },
            "description":
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.",
            "condition_id": "1",
            "selling_reason_id": "1",
            "dimension": {
                "width": "500",
                "height": "1600",
                "length": "600"
            },
            "tag_ids": [
                "04b34671-4eeb-4f1c-8435-5e029a0e455c",
                "04b34671-4eeb-4f1c-8435-5e029a0e455c"
            ],
            "payment_method_ids": [
                "04b34671-4eeb-4f1c-8435-5e029a0e455c",
                "04b34671-4eeb-4f1c-8435-5e029a0e455c"
            ]
        }
    """
}

#Preview {
    let json =  SDUIConstants.page.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYPage.self, from: json)
}
