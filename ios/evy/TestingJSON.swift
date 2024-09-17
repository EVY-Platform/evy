//
//  TestingJSON.swift
//  evy
//
//  Created by Geoffroy Lesage on 26/3/2024.
//

import SwiftUI

struct SDUIConstants {
    static let flows = "[\(viewItemFlow), \(createItemFlow)]"
    
    static let viewItemFlow = """
        {
            "id": "view_item",
            "name": "View Item",
            "type": "read",
            "data": "item",
            "pages": [{
                "id": "view",
                "title": "View Item",
                "rows": [{
                    "type": "Text",
                    "view": {
                        "content": {
                            "title": "My item is called",
                            "text": "{item.title}"
                        },
                        "max_lines": ""
                    }
                }],
                "footer": {
                    "type": "Button",
                    "view": {
                        "content": {
                            "title": "",
                            "label": "Go home"
                        }
                    },
                    "action": {
                        "target": "close"
                    }
                }
            }]
        }
    """
    
    static let createItemFlow = """
        {
            "id": "create_item",
            "name": "Create item",
            "type": "create",
            "data": "item",
            "pages": [\(createItemStep1), \(createItemStep2), \(createItemStep3), \(createItemStep4), \(createItemStep5)]
        }
    """
    
    static let createItemStep1 = """
        {
            "id": "step_1",
            "title": "Create listing",
            "rows": [
                \(selectPhotoRow),
                \(inputRow),
                \(inputRow),
                \(inputPriceRow),
                \(condition),
                \(sellingReason),
                \(columnContainerDimensionsRow),
                \(tagsRow)
            ],
            "footer": \(navigate1ButtonRow)
        }
    """
    static let createItemStep2 = """
        {
            "id": "step_2",
            "title": "Describe item",
            "rows": [\(textAreaRow)],
            "footer": \(navigate2ButtonRow)
        }
    """
    static let createItemStep3 = """
        {
            "id": "step_3",
            "title": "Pickup & delivery",
            "rows": [\(selectSegmentContainerRow)],
            "footer": \(navigate3ButtonRow)
        }
    """
    static let createItemStep4 = """
        {
            "id": "step_4",
            "title": "Payment options",
            "rows": [{
                        "type": "Info",
                        "view": {
                            "content": {
                                "title": "",
                                "text": "Payment will be made by the buyers on pickup"
                            }
                        }
                    },
                    \(paymentCashRow),
                    \(paymentAppRow)],
            "footer": \(navigate4ButtonRow)
        }
    """
    static let createItemStep5 = """
        {
            "id": "step_5",
            "title": "Sharing data publicly",
            "rows": [\(piiRow)],
            "footer": \(submitButtonRow)
        }
    """
    
    static let condition = """
        {
           "type": "Dropdown",
           "view": {
               "content": {
                   "title": "Condition",
                   "format": "{$0.value}",
                   "placeholder": "Choose one"
               },
                "data": "{conditions}"
           },
            "edit": {
                "destination": "{item.condition_id}"
            }
        }
    """
    
    static let sellingReason = """
        {
            "type": "Dropdown",
            "view": {
                "content": {
                    "title": "Selling Reason",
                    "format": "{$0.value}",
                    "placeholder": "Choose one"
                },
                "data": "{selling_reasons}"
            },
            "edit": {
                "destination": "{item.selling_reason_id}"
            }
        }
    """
    
    static let distancePickerRow = """
        {
           "type": "InlinePicker",
           "view": {
               "content": {
                   "title": "",
                   "format": "{$0.value}"
               },
                "data": "{durations}"
           },
            "edit": {
                "destination": "{distance}"
            }
        }
    """
    
    static let areaPickerRow = """
        {
           "type": "InlinePicker",
           "view": {
               "content": {
                   "title": "",
                   "format": "{$0.value}"
               },
                "data": "{areas}"
           },
            "edit": {
                "destination": "{area}"
            }
        }
    """
    
    static let pickupCalendarRow = """
        {
           "type": "Calendar",
           "view": {
               "content": {
                   "title": "",
                   "primary": "{pickupTimeslots}",
                   "secondary": "{deliveryTimeslots}"
               }
           },
            "edit": {
                "destination": "{pickupTimeslots}"
            }
        }
    """
    
    static let deliveryCalendarRow = """
        {
           "type": "Calendar",
           "view": {
               "content": {
                   "title": "",
                   "primary": "{deliveryTimeslots}",
                   "secondary": "{pickupTimeslots}"
               }
           },
            "edit": {
                "destination": "{deliveryTimeslots}"
            }
        }
    """
    
    static let searchTagsRow = """
        {
           "type": "Search",
           "view": {
               "content": {
                   "title": "",
                   "format": "{$0.value}",
                   "placeholder": "Search for tags"
               },
                "data": "{api:tags}"
           },
            "edit": {
                "destination": "{item.tags}"
            }
        }
    """
    
    static let tagsInputListRow = """
        {
            "type": "InputList",
            "view": {
                "content": {
                    "title": "Tags",
                    "placeholder": "Search for tags",
                    "format": "{$0.value}"
                },
                "data": "{item.tags}"
            }
        }
    """
    
    static let tagsRow = """
        {
            "type": "SheetContainer",
            "view": {
                "content": {
                    "title": "Tags",
                    "child": \(tagsInputListRow),
                    "children": [\(searchTagsRow)]
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
                    "content": "Photos: {count(item.photo_ids)}/10 - Chose your listing’s main photo first.",
                    "photos": "{item.photo_ids}"
                }
            },
            "edit": {
                "destination": "{item.photo_ids}",
                "minimum_amount": "1"
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
                "destination": "{item.title}"
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
                "destination": "{item.price.value}"
            }
        }
    """
    
    static let columnContainerDimensionsRow = """
        {
            "type": "ColumnContainer",
            "view": {
                "content": {
                    "title": "Dimensions (width x height x depth)",
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
                "destination": "{item.dimension.width}"
            }
        }
    """
    
    static let addressRow = """
        {
            "type": "TextAction",
            "view": {
                "content": {
                    "title": "Where",
                    "text": "{formatAddress(item.address)}",
                    "placeholder": "Enter pick up address",
                    "action": "Change"
                }
            },
            "edit": {
                "destination": "{item.address}"
            }
        }
    """
    
    static let paymentCashRow = """
        {
            "type": "TextSelect",
            "view": {
                "content": {
                    "title": "Accept cash",
                    "text": "Let buyers know you will accept cash on pickup"
                }
            },
            "edit": {
                "destination": "{item.payment_methods.cash}"
            }
        }
    """
    
    static let paymentAppRow = """
        {
            "type": "TextSelect",
            "view": {
                "content": {
                    "title": "Accept app payments",
                    "text": "Benefit from EVY seller protection when accepting payments through the app on pickup\\n \u{2022} Cards are verified before the purchase\\n \u{2022} Payment is transferred immediately when both buyer and seller confirm using a temporary code"
                }
            },
            "edit": {
                "destination": "{item.payment_methods.app}"
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
                "destination": "{item.dimension.height}"
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
                "destination": "{item.dimension.length}"
            }
        }
    """
    
    static let navigate1ButtonRow = """
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
                "target": "navigate:create_item:step_2"
            }
        }
    """
    
    static let navigate2ButtonRow = """
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
                "target": "navigate:create_item:step_3"
            }
        }
    """
    
    static let navigate3ButtonRow = """
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
                "target": "navigate:create_item:step_4",
                "condition": "{count(item.title) > 10}"
            }
        }
    """
    
    static let navigate4ButtonRow = """
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
                "target": "navigate:create_item:step_5"
            }
        }
    """
    
    static let sheetContainerRow = """
        {
           "type": "SheetContainer",
           "view": {
               "content": {
                   "title": "Where",
                   "child": \(addressRow),
                   "children": [{
                       "type": "Search",
                       "view": {
                           "content": {
                               "title": "",
                               "format": "{$0.unit} {$0.street}, {$0.city} {$0.state} {$0.postcode}",
                               "placeholder": "Search address"
                           },
                            "data": "local:address"
                       },
                        "edit": {
                            "destination": "{item.address}"
                        }
                    }]
               }
           }
        }
    """
    
    static let textRowShort = """
        {
            "type": "Text",
            "view": {
                "content": {
                    "title": "{item.title}",
                    "text": "Lorem Ipsum is simply ::star.square.on.square.fill::"
                },
                "max_lines": ""
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
    
    static let infoRow = """
        {
            "type": "Info",
            "view": {
                "content": {
                    "title": "",
                    "text": "Allow buyers to pick up the item"
                }
            }
        }
    """
    
    static let infoRowWithTitle = """
        {
            "type": "Info",
            "view": {
                "content": {
                    "title": "A title",
                    "text": "Allow buyers to pick up the item"
                }
            }
        }
    """
    
    static let piiRow = #"""
        {
            "type": "Info",
            "view": {
                "content": {
                    "title": "",
                    "text": "EVY is all about Data privacy. Your identity and profile information remains encrypted on your phone and inaccessible to anyone but you. However, the following information about your listing will be public:\n\n* Title & description\n* Photos\n* Condition & selling reason\n* Price\n* Dimension\n* Pickup address & schedule\n* Delivery schedule"
                }
            }
        }
    """#
    
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
                "target": "submit:item"
            }
        }
    """
    
    static let textAreaRow = """
        {
            "type": "TextArea",
            "view": {
                "content": {
                   "title": "",
                   "value": "{item.description}",
                   "placeholder": "Write a short description of your product"
                }
            },
            "edit": {
                "destination": "{item.description}"
            }
        }
    """
    
    static let pickupContainer = """
        {
            "type": "ListContainer",
            "view": {
                "content": {
                    "title": "",
                    "children": [
                    {
                        "type": "Info",
                        "view": {
                            "content": {
                                "title": "",
                                "text": "Allow buyers to pick up the item"
                            }
                        }
                    }, \(sheetContainerRow),{
                        "type": "Input",
                        "view": {
                            "content": {
                                "title": "",
                                "placeholder": "Additional information",
                                "value": "{item.address.instructions}"
                            }
                        },
                        "edit": {
                            "destination": "{item.address.instructions}"
                        }
                    }, {
                        "type": "Info",
                        "view": {
                            "content": {
                                "title": "When",
                                "text": "When are you available for buyers to inspect or pick up this item"
                            }
                        }
                    }, \(pickupCalendarRow)]
                }
            }
        }
    """
    
    static let deliveryContainer = """
        {
            "type": "ListContainer",
            "view": {
                "content": {
                    "title": "",
                    "children": [
                    {
                        "type": "Info",
                        "view": {
                            "content": {
                                "title": "",
                                "text": "Deliver directly to the buyer"
                            }
                        }
                    }, {
                        "type": "Input",
                        "view": {
                            "content": {
                                "title": "Surcharge",
                                "value": "{formatCurrency(item.price)}",
                                "placeholder": "Do you want to charge for delivery?"
                            }
                        },
                        "edit": {
                            "destination": "{item.price.value}"
                        }
                    }, {
                        "type": "Info",
                        "view": {
                            "content": {
                                "title": "How far",
                                "text": "How long can you travel to deliver this item"
                            }
                        }
                    }, \(distancePickerRow), {
                        "type": "Info",
                        "view": {
                            "content": {
                                "title": "When",
                                "text": "When are you available to deliver this item"
                            }
                        }
                    }, \(deliveryCalendarRow)]
                }
            }
        }
    """
    
    static let shippingContainer = """
        {
            "type": "ListContainer",
            "view": {
                "content": {
                    "title": "",
                    "children": [
                    {
                        "type": "Info",
                        "view": {
                            "content": {
                                "title": "",
                                "text": "Postal shipping at the buyer’s expense"
                            }
                        }
                    }, {
                        "type": "Input",
                        "view": {
                            "content": {
                                "title": "Where from",
                                "value": "",
                                "placeholder": "Postal code you will be shipping from"
                            }
                        },
                        "edit": {
                            "destination": ""
                        }
                    }, {
                        "type": "Info",
                        "view": {
                            "content": {
                                "title": "Where to",
                                "text": "Select how far you are willing to ship"
                            }
                        }
                    }, \(areaPickerRow), \(columnContainerDimensionsRow), {
                        "type": "Input",
                        "view": {
                            "content": {
                                "title": "Weight (kg)",
                                "value": "{formatWeight(item.dimension.weight)}",
                                "placeholder": "Wight"
                            }
                        },
                        "edit": {
                            "destination": "{item.dimension.weight}"
                        }
                    }]
                }
            }
        }
    """
    
    static let selectSegmentContainerRow = """
        {
            "type": "SelectSegmentContainer",
            "view": {
                "content": {
                    "title": "Pickup",
                    "children": [{
                        "title": "Pickup",
                        "child": \(pickupContainer)
                    },
                    {
                        "title": "Delivery",
                        "child": \(deliveryContainer)
                    },
                    {
                        "title": "Shipping",
                        "child": \(shippingContainer)
                    }]
                }
            }
        }
    """
}

struct DataConstants {
    static let address = """
        {
            "unit": "23-25",
            "street": "Rosebery Avenue",
            "city": "Rosebery",
            "postcode": "2018",
            "state": "NSW",
            "country": "Australia",
            "location": {
                "latitude": "45.323124",
                "longitude": "-3.424233"
            },
            "instructions": ""
        }
    """
    static let address2 = """
        {
            "unit": "100",
            "street": "Main Street",
            "city": "Rosebery",
            "postcode": "2018",
            "state": "NSW",
            "country": "Australia",
            "location": {
                "latitude": "45.323124",
                "longitude": "-3.424233"
            },
            "instructions": ""
        }
    """
    static let selling_reasons = """
        [{
            "id": "76d781c6-7ab1-4b5e-99d5-60d417e3c382",
            "value": "No longer used",
        },{
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
    static let durations = """
        [{
            "id": "68e52916-7a07-4a07-ae0c-52e7800b9b9f",
            "value": "5 min",
        },{
            "id": "8e1cd2bf-d94f-4bb0-bd68-fc74434deabe",
            "value": "10 min",
        },{
            "id": "1eedac33-eb0b-4796-9853-50ad4036179f",
            "value": "15 min",
        },{
            "id": "69f25102-822c-436c-a6c1-3b49f887355e",
            "value": "30 min",
        }]
    """
    static let areas = """
        [{
            "id": "68e52916-7a07-4a07-ae0c-52e7800b9b9f",
            "value": "City",
        },{
            "id": "8e1cd2bf-d94f-4bb0-bd68-fc74434deabe",
            "value": "State",
        },{
            "id": "1eedac33-eb0b-4796-9853-50ad4036179f",
            "value": "Country",
        },{
            "id": "69f25102-822c-436c-a6c1-3b49f887355e",
            "value": "World",
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
            "photo_ids": ["printer","printer_logo"],
            "price": {
                "currency": "AUD",
                "value": "250"
            },
            "seller_id": "04b34671-4eeb-4f1c-8435-5e029a0e455c",
            "address": \(address),
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
                "length": "600",
                "weight": "10"
            },
            "tags": [{
                "id": "tt0076759",
                "value": "Episode",
            },{
                "id": "8e1cd2bf-d94f-4bb0-bd68-fc74434deabe",
                "value": "Tag B with extras",
            },{
                "id": "1eedac33-eb0b-4796-9853-50ad4036179f",
                "value": "Tag C",
            },{
                "id": "69f25102-822c-436c-a6c1-3b49f887355e",
                "value": "Tag D",
            }],
            "payment_methods": {
                "cash": false,
                "app": false
            }
        }
    """
    
    static let pickupTimeslots = """
    [
        {
            "x": 0,
            "y": 0,
            "header": "Wed 18",
            "start_label": "7:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 1,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 2,
            "header": "Wed 18",
            "start_label": "8:00",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 3,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 4,
            "header": "Wed 18",
            "start_label": "9:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 5,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 6,
            "header": "Wed 18",
            "start_label": "10:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 7,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 8,
            "header": "Wed 18",
            "start_label": "11:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 9,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 10,
            "header": "Wed 18",
            "start_label": "12:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 11,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 12,
            "header": "Wed 18",
            "start_label": "13:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 14,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 15,
            "header": "Wed 18",
            "start_label": "14:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 16,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 17,
            "header": "Wed 18",
            "start_label": "15:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 18,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 19,
            "header": "Wed 18",
            "start_label": "16:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 20,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 21,
            "header": "Wed 18",
            "start_label": "17:00",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 22,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 23,
            "header": "Wed 18",
            "start_label": "18:00",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 24,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "19:00",
            "selected": true
        },{
            "x": 1,
            "y": 0,
            "header": "Thu 19",
            "start_label": "7:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 1,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 2,
            "header": "Thu 19",
            "start_label": "8:00",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 3,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 4,
            "header": "Thu 19",
            "start_label": "9:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 5,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 6,
            "header": "Thu 19",
            "start_label": "10:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 7,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 8,
            "header": "Thu 19",
            "start_label": "11:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 9,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 10,
            "header": "Thu 19",
            "start_label": "12:00",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 11,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 12,
            "header": "Thu 19",
            "start_label": "13:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 14,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 15,
            "header": "Thu 19",
            "start_label": "14:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 16,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 17,
            "header": "Thu 19",
            "start_label": "15:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 18,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 19,
            "header": "Thu 19",
            "start_label": "16:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 20,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 21,
            "header": "Thu 19",
            "start_label": "17:00",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 22,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 23,
            "header": "Thu 19",
            "start_label": "18:00",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 24,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "19:00",
            "selected": true
        },{
            "x": 2,
            "y": 0,
            "header": "Fri 20",
            "start_label": "7:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 1,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 2,
            "header": "Fri 20",
            "start_label": "8:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 3,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 4,
            "header": "Fri 20",
            "start_label": "9:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 5,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 6,
            "header": "Fri 20",
            "start_label": "10:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 7,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 8,
            "header": "Fri 20",
            "start_label": "11:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 9,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 10,
            "header": "Fri 20",
            "start_label": "12:00",
            "end_label": "",
            "selected": true
        },{
            "x": 2,
            "y": 11,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 2,
            "y": 12,
            "header": "Fri 20",
            "start_label": "13:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 14,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 15,
            "header": "Fri 20",
            "start_label": "14:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 16,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 17,
            "header": "Fri 20",
            "start_label": "15:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 18,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 19,
            "header": "Fri 20",
            "start_label": "16:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 20,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 21,
            "header": "Fri 20",
            "start_label": "17:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 22,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 23,
            "header": "Fri 20",
            "start_label": "18:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 24,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "19:00",
            "selected": false
        },{
            "x": 3,
            "y": 0,
            "header": "Sat 21",
            "start_label": "7:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 1,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 2,
            "header": "Sat 21",
            "start_label": "8:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 3,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 4,
            "header": "Sat 21",
            "start_label": "9:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 5,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 6,
            "header": "Sat 21",
            "start_label": "10:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 7,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 8,
            "header": "Sat 21",
            "start_label": "11:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 9,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 10,
            "header": "Sat 21",
            "start_label": "12:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 11,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 12,
            "header": "Sat 21",
            "start_label": "13:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 14,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 15,
            "header": "Sat 21",
            "start_label": "14:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 16,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 17,
            "header": "Sat 21",
            "start_label": "15:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 18,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 19,
            "header": "Sat 21",
            "start_label": "16:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 20,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 21,
            "header": "Sat 21",
            "start_label": "17:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 22,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 23,
            "header": "Sat 21",
            "start_label": "18:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 24,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "19:00",
            "selected": false
        }
    ]
    """
    
    static let deliveryTimeslots = """
    [
        {
            "x": 0,
            "y": 0,
            "header": "Wed 18",
            "start_label": "7:00",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 1,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 2,
            "header": "Wed 18",
            "start_label": "8:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 3,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 4,
            "header": "Wed 18",
            "start_label": "9:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 5,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 6,
            "header": "Wed 18",
            "start_label": "10:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 7,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 8,
            "header": "Wed 18",
            "start_label": "11:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 9,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 10,
            "header": "Wed 18",
            "start_label": "12:00",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 11,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 0,
            "y": 12,
            "header": "Wed 18",
            "start_label": "13:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 14,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 15,
            "header": "Wed 18",
            "start_label": "14:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 16,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 17,
            "header": "Wed 18",
            "start_label": "15:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 18,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 19,
            "header": "Wed 18",
            "start_label": "16:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 20,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 21,
            "header": "Wed 18",
            "start_label": "17:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 22,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 23,
            "header": "Wed 18",
            "start_label": "18:00",
            "end_label": "",
            "selected": false
        },{
            "x": 0,
            "y": 24,
            "header": "Wed 18",
            "start_label": "",
            "end_label": "19:00",
            "selected": false
        },{
            "x": 1,
            "y": 0,
            "header": "Thu 19",
            "start_label": "7:00",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 1,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 2,
            "header": "Thu 19",
            "start_label": "8:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 3,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 4,
            "header": "Thu 19",
            "start_label": "9:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 5,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 6,
            "header": "Thu 19",
            "start_label": "10:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 7,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 8,
            "header": "Thu 19",
            "start_label": "11:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 9,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 10,
            "header": "Thu 19",
            "start_label": "12:00",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 11,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 1,
            "y": 12,
            "header": "Thu 19",
            "start_label": "13:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 14,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 15,
            "header": "Thu 19",
            "start_label": "14:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 16,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 17,
            "header": "Thu 19",
            "start_label": "15:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 18,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 19,
            "header": "Thu 19",
            "start_label": "16:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 20,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 21,
            "header": "Thu 19",
            "start_label": "17:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 22,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 23,
            "header": "Thu 19",
            "start_label": "18:00",
            "end_label": "",
            "selected": false
        },{
            "x": 1,
            "y": 24,
            "header": "Thu 19",
            "start_label": "",
            "end_label": "19:00",
            "selected": false
        },{
            "x": 2,
            "y": 0,
            "header": "Fri 20",
            "start_label": "7:00",
            "end_label": "",
            "selected": true
        },{
            "x": 2,
            "y": 1,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 2,
            "y": 2,
            "header": "Fri 20",
            "start_label": "8:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 3,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 4,
            "header": "Fri 20",
            "start_label": "9:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 5,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 6,
            "header": "Fri 20",
            "start_label": "10:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 7,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 8,
            "header": "Fri 20",
            "start_label": "11:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 9,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 10,
            "header": "Fri 20",
            "start_label": "12:00",
            "end_label": "",
            "selected": true
        },{
            "x": 2,
            "y": 11,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 2,
            "y": 12,
            "header": "Fri 20",
            "start_label": "13:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 14,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 15,
            "header": "Fri 20",
            "start_label": "14:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 16,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 17,
            "header": "Fri 20",
            "start_label": "15:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 18,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 19,
            "header": "Fri 20",
            "start_label": "16:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 20,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 21,
            "header": "Fri 20",
            "start_label": "17:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 22,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 23,
            "header": "Fri 20",
            "start_label": "18:00",
            "end_label": "",
            "selected": false
        },{
            "x": 2,
            "y": 24,
            "header": "Fri 20",
            "start_label": "",
            "end_label": "19:00",
            "selected": false
        },{
            "x": 3,
            "y": 0,
            "header": "Sat 21",
            "start_label": "7:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 1,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 2,
            "header": "Sat 21",
            "start_label": "8:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 3,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 4,
            "header": "Sat 21",
            "start_label": "9:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 5,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 6,
            "header": "Sat 21",
            "start_label": "10:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 7,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 8,
            "header": "Sat 21",
            "start_label": "11:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 9,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 10,
            "header": "Sat 21",
            "start_label": "12:00",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 11,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": true
        },{
            "x": 3,
            "y": 12,
            "header": "Sat 21",
            "start_label": "13:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 14,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 15,
            "header": "Sat 21",
            "start_label": "14:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 16,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 17,
            "header": "Sat 21",
            "start_label": "15:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 18,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 19,
            "header": "Sat 21",
            "start_label": "16:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 20,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 21,
            "header": "Sat 21",
            "start_label": "17:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 22,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 23,
            "header": "Sat 21",
            "start_label": "18:00",
            "end_label": "",
            "selected": false
        },{
            "x": 3,
            "y": 24,
            "header": "Sat 21",
            "start_label": "",
            "end_label": "19:00",
            "selected": false
        }
    ]
    """
}
