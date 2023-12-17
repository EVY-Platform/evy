# Data example for the view item page

#### Booking as it would be stored in the database

```
{
	"item_id": x,
	"timeslot": 1700894934,
	"buyer_id": a
}
```

#### Item as it would be stored in the database

```
{
	"id": "a9e9feba-d1ba-4f78-ab3c-3ce7cc108989",
	"title": "Amazing Fridge",
	"photos": [
        {
            "id": "04b34671-4eeb-4f1c-8435-5e029a0e455c"
        },
        {
            "id": "97a953eb-0206-4560-8716-d58c8cd94a62"
        },
        {
            "id": "d7b2efd7-3be6-49b7-9dad-0569c3ad4572"
        }
    ],
	"price": {
		"currency": "AUD",
		"value": 250
	},
	"seller": {
		"fidelity_rate": 0.88,
		"items_sold": 4
	},
	"address": {
		"street": "x",
		"city": "Rosebery",
		"postcode": "2018",
		"state": "NSW",
		"country": "Australia",
		"location": {
			"latitude": 45.323124,
			"longitude": -3.424233
		}
	},
	"created_timestamp": 1701471377,
	"transfer_option": {
		"pickup": {
			"timeslots": [
				{
					"timeslot": 1700894934
				},
				{
					"timeslot": 17008944234
				},
				{
					"timeslot": 1800894934
				}
			]
		},
		"delivery": {
			"fee": 50.0,
			"timeslots": [
				{
					"timeslot": 1700894934
				},
				{
					"timeslot": 17008944234
				},
				{
					"timeslot": 1800894934
				}
			]
		},
		"ship": {
			"fee": 5.0,
			"transfer_provider": {
				// This is usually fetched from API
				"name": "Australia Post",
				"logo": "image_id",
				"eta": "2-5 days once deposited",
				"fee": 25.0
			}
		}
	},
	"description":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.",
	"condition": "Used - Like New",
	"selling_reason": "moving out",
	"dimension": {
		"width": 500,
		"height": 1600,
		"length": 600
	},
	"tags": {
		"id": "ta",
		"id": "tb"
	},
	"payment_methods": ["card", "cash"]
}
```

#### What the app would receive from the backend to display for a view item page

```
[
	{
		"type": "Carousel",
		"content": {
			"photo_ids": ["b", "a", "c"]
		}
	},
	{
		"type": "Title",
		"content": {
			"title": "Amazing Fridge",
			"title_detail": "$250",
			"subtitle_1": ":star_doc: 88% - 4 items sold",
			"subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
		}
	},
	{
		"type": "SegmentedControl",
		"content": {
			"children": [
				{
					"title": "Pickup",
					"children": [{
						"type": "TimeslotPicker",
						"content": {
							"icon": ":pickup:",
							"subtitle": "Meet at the pickup address",
							"details": "",
							"dates_with_timeslots": [
				                {
				                    "header": "Wed",
				                    "date": "8 nov.",
				                    "timeslots": [
				                        {
				                            "timeslot": "11:30",
				                            "available": true
				                        }
				                    ]
				                },
				                {
				                    "header": "Thu",
				                    "date": "9 nov.",
				                    "timeslots": [
				                        {
				                            "timeslot": "10:30",
				                            "available": false
				                        },
				                        {
				                            "timeslot": "11:00",
				                            "available": true
				                        }
				                    ]
				                }
				            ]
						}
					}]
				},
				{
					"title": "Deliver",
					"children": [{
						"type": "TimeslotPicker",
						"content": {
							"icon": ":car:",
							"subtitle": "Delivered at your door",
							"details": "+ $5.00",
							"dates_with_timeslots": [
				                {
				                    "header": "Wed",
				                    "date": "8 nov.",
				                    "timeslots": [
				                        {
				                            "timeslot": "11:30",
				                            "available": true
				                        }
				                    ]
				                },
				                {
				                    "header": "Thu",
				                    "date": "9 nov.",
				                    "timeslots": [
				                        {
				                            "timeslot": "10:30",
				                            "available": false
				                        },
				                        {
				                            "timeslot": "11:00",
				                            "available": true
				                        }
				                    ]
				                }
				            ]
						}
					}]
				},
				{
					"title": "Ship",
					"children": [{
						"type": "Detail",
						"content": {
							"title": "Australia Post",
							"logo": "image_id",
							"subtitle": "2-5 days once deposited",
							"details": "$25.00"
						}
					},
					{
						"type": "Disclaimer",
						"content": {
							"icon": ":lock:",
							"title": "EVY Protection",
							"subtitle": "Your money will be held until Australia Post confirms delivery"
						}
					}]
				}
			]
		}
	},
	{
		"type": "Text",
		"content": {
			"title": "Description",
			"content":
				"Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place."
		}
	},
	{
		"type": "Detail",
		"content": {
			"logo": ":paper:",
			"title": "Selling reason",
			"subtitle": "Moving out",
			"detail": ""
		}
	},
	{
		"type": "Detail",
		"content": {
			"logo": ":ruler:",
			"title": "Dimensions",
			"subtitle": "250 (w) x 120 (h) x 250 (l)",
			"detail": ""
		}
	},
	{
		"type": "Detail",
		"content": {
			"logo": ":alert:",
			"title": "Condition",
			"subtitle": "Like new",
			"detail": ""
		}
	},
	{
		"type": "Address",
		"content": {
			"title": "Pickup location",
			"line_1": "23-25 Rosebery Avenue",
			"line_2": "2018 Rosebery, NSW",
			"location": {
				"latitude": 45.323124,
				"longitude": -3.424233
			}
		}
	},
	{
		"type": "PaymentOptions",
		"content": {
			"title": "Payment methods accepted",
			"options": [
				{
					"icon": ":visa:",
					"label": "Card",
					"disclaimer": ":lock: Benefit from EVY buyer protection"
				},
				{
					"icon": ":dollar:",
					"label": "Cash",
					"disclaimer": ""
				}
			]
		}
	}
]
```

#### What would be stored in the database for a view item page

```

[
	{
		"type": "Carousel",
		"content": {
			"photo_ids": "{item.photos[].id}"
		}
	},
	{
		"type": "Title",
		"content": {
			"title": "{item.title}",
			"title_detail": "{formatCurrency(item.price)}",
			"subtitle_1":
				":star_doc:{item.seller.fidelity_rating}% - {item.seller.items_sold} items sold",
			"subtitle_2":
				"{item.address.city}, {item.address.state} -  Posted on {formatTimestamp(item.created_timestamp, 'MM DD')}"
		}
	},
	{
		"type": "SegmentedControl",
		"content": {
			"children": [
				{
					"title": "Pickup",
					"enabled":
						"{item.transfer_option.pickup && item.transfer_option.pickup.dates_with_timeslots.length > 0}",
					"hide_if_empty": "{true}",
					"empty_message": "Option not available",
					"child": {
						"type": "TimeslotPicker",
						"content": {
							"icon": ":pickup:",
							"details": "",
							"subtitle": "Meet at the pickup location",
							"timeslots": "{item.transfer_option.pickup.dates_with_timeslots}",
						},
					}
				},
				{
					"title": "Deliver",
					"enabled":
						"{item.transfer_option.delivery && item.transfer_option.delivery.dates_with_timeslots.length > 0}",
					"hide_if_empty": "{true}",
					"empty_message": "Option not available",
					"child": {
						"type": "TimeslotPicker",
						"content": {
							"icon": ":car:",
							"details": "+ formatCurrency(item.transfer_option.delivery.fee)",
							"subtitle": "Delivered at your door",
							"timeslots": "{item.transfer_option.delivery.dates_with_timeslots}",
						},
					}
				},
				{
					"title": "Ship",
					"enabled": "{item.transfer_option.ship.transfer_provider}",
					"hide_if_empty": "{true}",
					"empty_message": "Option not available",
					"children": [{
						"type": "Detail",
						"content": {
							// This is usually fetched from API
							"title": "{transfer_provider.name}",
							"logo": "{transfer_provider.logo}",
							"subtitle": "{transfer_provider.eta}",
							"details":
								"{formatCurrency(item.transfer_option.ship.fee + transfer_provider.fee)}"
						}
					},
					{
						"type": "Disclaimer",
						"content": {
							"icon": ":lock:",
							"title": "EVY Protection",
							"subtitle": "Your money will be held until {transfer_provider.name} confirms delivery"
						}
					}]
				}
			]
		}
	},
	{
		"type": "Text",
		"content": {
			"title": "Description",
			"content": "{item.description}"
		}
	},
	{
		"type": "Detail",
		"content": {
			"logo": ":alert:",
			"title": "Condition",
			"subtitle": "{item.condition}",
			"detail": ""	
		}
	},
	{
		"type": "Detail",
		"content": {
			"logo": ":paper:",
			"title": "Selling reason",
			"subtitle": "{item.selling_reason}",
			"detail": ""
		}
	},
	{
		"type": "Detail",
		"content": {
			"logo": ":ruler:",
			"title": "Dimensions",
			"subtitle":
				"{item.dimension.width} (w) x {item.dimension.height} (h) x {item.dimension.length} (l)",
			"detail": ""
		}
	},
	{
		"type": "Address",
		"content": {
			"title": "Pickup location",
			"line_1": "{item.address.street}",
			"line_2":
				"{item.address.zipcode} {item.address.city}, {item.address.state}",
			"location": "{item.address.location}"
		}
	},
	{
		"type": "PaymentOptions",
		"content": {
			"title": "Payment methods accepted",
			"options": [
				{
					"icon": ":visa:",
					"label": "Card",
					"details": ":lock: Benefit from EVY buyer protection",
					enabled: "{item.payment_methods.find('card')}"
				},
				{
					"icon": ":bank:",
					"label": "Bank",
					"details": ":lock: Benefit from EVY buyer protection",
					"enabled": "{item.payment_methods.find('bank')}"
				},
				{
					"icon": ":dollar:",
					"label": "Cash",
					"enabled": "{item.payment_methods.find('cash')}"
				}
			]
		}
	}
]
```
