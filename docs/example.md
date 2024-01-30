# Data example for the view item page

#### Sample conditions as stored in the database

```
{
	"id": "1",
	"value": "For parts",
}
```

```
{
	"id": "2",
	"value": "New",
}
```

```
{
	"id": "3",
	"value": "Used - like new",
}
```

```
{
	"id": "4",
	"value": "Used - good",
}
```

```
{
	"id": "5",
	"value": "Used - fair",
}
```

#### Sample selling reason as stored in the database

```
{
	"id": "1",
	"value": "No longer used",
}
```

```
{
	"id": "2",
	"value": "Moving out",
}
```

```
{
	"id": "3",
	"value": "Doesn't fit",
}
```

#### Sample Provider as stored in the database

```
{
	"id": "post_office_id",
	"name": "Australia Post",
	"logo_id": "_image_id_",
	"eta": "2-5 days once deposited",
	"cost": {
		"currency": "AUD",
		"value": 15.00
	},
}
```

#### Booking as it would be stored in the database

```
{
	"item_id": "x",
	"timeslot": "1700894934",
	"buyer_id": "a"
}
```

#### Item as it would be stored in the database

```
{
	"id": "a9e9feba-d1ba-4f78-ab3c-3ce7cc108989",
	"title": "Amazing Fridge",
	"photos": [
		{
			"id": 04b34671-4eeb-4f1c-8435-5e029a0e455c"
		},
		{
			"id": 97a953eb-0206-4560-8716-d58c8cd94a62"
		},
		{
			"id": d7b2efd7-3be6-49b7-9dad-0569c3ad4572"
		}
	],
	"price": {
		"currency": "AUD",
		"value": 250
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
			"latitude": 45.323124,
			"longitude": -3.424233
		}
	},
	"created_timestamp": "1701471377",
	"transfer_option": {
		"pickup": {
			"timeslots": [
				{
					"timeslot": "1700894934"
				},
				{
					"timeslot": "17008944234"
				},
				{
					"timeslot": "1800894934"
				}
			]
		},
		"delivery": {
			"fee": {
				"currency": "AUD",
				"value": 5.00
			},
			"timeslots": [
				{
					"timeslot": "1700894934"
				},
				{
					"timeslot": "17008944234"
				},
				{
					"timeslot": "1800894934"
				}
			]
		},
		"ship": {
			"fee": {
				"currency": "AUD",
				"value": 10.00
			},
			"transfer_provider_id": "post_office_id" 
		}
	},
	"description":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.",
	"condition_id": 1,
	"selling_reason_id": 1,
	"dimension": {
		"width": 500,
		"height": 1600,
		"length": 600
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
```

#### What the app would receive from the backend to display for a view item page

```
[
	{
		"type": "Carousel",
		"content": {
			"image_ids": ["_image_id_", "_image_id_"],
		}
	},
	{
		"type": "Title",
		"content": {
			"title": "Amazing Fridge",
			"title_detail": "$250",
			"subtitle_1": "::star_doc:: 88% - 4 items sold",
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
							"icon": "_image_id_",
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
							"icon": "_image_id_",
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
							"icon": "_image_id_",
							"subtitle": "2-5 days once deposited",
							"details": "$25.00"
						}
					},
					{
						"type": "Disclaimer",
						"content": {
							"icon": "_image_id_",
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
				"Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place.",
			"maxLines": "2"
		}
	},
	{
		"type": "ContainerList",
		"content": {
			"children": [
				{
					"type": "Detail",
					"content": {
						"icon": "_image_id_",
						"title": "Selling reason",
						"subtitle": "Moving out",
						"detail": ""
					}
				},
				{
					"type": "Detail",
					"content": {
						"icon": "_image_id_",
						"title": "Dimensions",
						"subtitle": "250 (w) x 120 (h) x 250 (l)",
						"detail": ""
					}
				},
				{
					"type": "Detail",
					"content": {
						"icon": "_image_id_",
						"title": "Condition",
						"subtitle": "Like new",
						"detail": ""
					}
				}
			]
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
					"icon": "_image_id_",
					"label": "Card",
					"disclaimer": ":lock Benefit from EVY buyer protection"
				},
				{
					"icon": "_image_id_",
					"label": "Cash"
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
			"image_ids": "{item.photos[].id}"
		}
	},
	{
		"type": "Title",
		"content": {
			"title": "{item.title}",
			"title_detail": "{formatCurrency(item.price)}",
			"subtitle_1":
				"::star_doc::{item.seller.fidelity_rating}% - {item.seller.items_sold} items sold",
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
					"child": {
						"type": "TimeslotPicker",
						"content": {
							"icon": "_image_id_",
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
					"child": {
						"type": "TimeslotPicker",
						"content": {
							"icon": "_image_id_",
							"details": "+ formatCurrency(item.transfer_option.delivery.fee)",
							"subtitle": "Delivered at your door",
							"timeslots": "{item.transfer_option.delivery.dates_with_timeslots}",
						},
					}
				},
				{
					"title": "Ship",
					"enabled": "{item.transfer_option.ship.transfer_provider}",
					"children": [{
						"type": "Detail",
						"content": {
							// This is usually fetched from API
							"title": "{transfer_provider.name}",
							"icon": "{transfer_provider.logo_id}",
							"subtitle": "{transfer_provider.eta}",
							"details":
								"{formatCurrency(item.transfer_option.ship.fee + transfer_provider.fee)}"
						}
					},
					{
						"type": "Disclaimer",
						"content": {
							"icon": "_image_id_",
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
			"content": "{item.description}",
			"maxLines": "2",
		}
	},
	{
		"type": "ContainerList",
		"content": {
			"children": [
				{
					"type": "Detail",
					"content": {
						"icon": "_image_id_",
						"title": "Condition",
						"subtitle": "{item.condition.value}",
						"detail": ""	
					}
				},
				{
					"type": "Detail",
					"content": {
						"icon": "_image_id_",
						"title": "Selling reason",
						"subtitle": "{item.selling_reason.value}",
						"detail": ""
					}
				},
				{
					"type": "Detail",
					"content": {
						"icon": "_image_id_",
						"title": "Dimensions",
						"subtitle":
							"{item.dimension.width} (w) x {item.dimension.height} (h) x {item.dimension.length} (l)",
						"detail": ""
					}
				},
			]	
		}
	},
	{
		"type": "Address",
		"content": {
			"title": "Pickup location",
			"line_1": "{formatAddressLine1(item.address)}",
			"line_2": "{formatAddressLine2(item.address)}"
		}
	},
	{
		"type": "PaymentOptions",
		"content": {
			"title": "Payment methods accepted",
			"options": [
				{
					"icon": "_image_id_",
					"label": "Card",
					"disclaimer": "::lock:: Benefit from EVY buyer protection",
					enabled: "{item.payment_methods.find('card')}"
				},
				{
					"icon": "_image_id_",
					"label": "Bank",
					"disclaimer": "::lock:: Benefit from EVY buyer protection",
					"enabled": "{item.payment_methods.find('bank')}"
				},
				{
					"icon": "_image_id_",
					"label": "Cash",
					"enabled": "{item.payment_methods.find('cash')}"
				}
			]
		}
	}
]
```

### What would the first page of creating an item look like in the database
```
[
	{
	    "type": "PhotoUpload",
	    "content": {
	        "icon": "::image_upload::",
	        "subtitle": "Add photos",
	        "content": "Photos: {count(item.photos)}/10 - Chose your listing’s main photo first.",
			"image_ids": "{item.photos[].id}"
	    },
		"formatting": [],
	    "data": {
	        "source": "",
	        "destination": "{item.photos}"
	    }
	},
	{
	    "type": "Input",
	    "content": {
	    	"title": "Title",
			"value": "{item.title}",
	    	"placeholder": "My iPhone 20"
	    },
		"formatting": [],
	    "data": {
	        "source": "",
	        "destination": "{item.title}"
	    }
	},
	{
	    "type": "Input",
	    "content": {
	    	"title": "Price",
			"value": "{formatCurrency(item.price)}",
	    	"placeholder": "$20.00"
	    },
		"formatting": [{
			"content": "value",
			"format": "{formatCurrency(item.price)}"
		}],
	    "data": {
	        "source": "",
	        "destination": "{item.price}"
	    }
	},
	{
	    "type": "Dropdown",
	    "content": {
	        "placeholder": "Condition",
			"value": "item.condition.value"
	    },
		"formatting": [{
	        "content": "placeholder",
	        "format": "{item.condition.value}"
	    }],
	    "data": {
	        "source": "{conditions}",
	        "destination": "{item.condition}"
	    }
	},
	{
	    "type": "Dropdown",
	    "content": {
	        "placeholder": "Selling reason",
			"value": "{item.selling_reason.value}"
	    },
		"formatting": [{
	        "content": "placeholder",
	        "format": "{item.selling_reason.value}"
	    }],
	    "data": {
	        "source": "{selling_reasons}",
	        "destination": "{item.selling_reason}"
	    }
	},
	{
	    "type": "ColumnContainer",
		"title": "Dimensions",
	    "content": {
	    	"children": [
	    		{
				    "type": "Input",
				    "content": {
						"title": "",
				    	"placeholder": "Width",
						"value": "{formatDimension(item.dimension.width)}"
				    },
					"formatting": [{
				        "content": "placeholder",
				        "format": "{formatDimension(item.dimension.width)}"
				    }],
				    "data": {
				    	"source": "",
				    	"destination": "{item.dimension.width}"
				    }
				},
	    		{
				    "type": "Input",
				    "content": {
						"title": "",
				    	"placeholder": "Height",
						"value": "{formatDimension(item.dimension.height)}"
				    },
					"formatting": [{
				        "content": "placeholder",
				        "format": "{formatDimension(item.dimension.height)}"
				    }],
				    "data": {
				    	"source": "",
				    	"destination": "{item.dimension.height}"
				    }
				},
	    		{
				    "type": "Input",
				    "content": {
						"title": "",
				    	"placeholder": "Length",
						"value": "{formatDimension(item.dimension.length)}"
				    },
					"formatting": [{
				        "content": "placeholder",
				        "format": "{formatDimension(item.dimension.length)}"
				    }],
				    "data": {
				    	"source": "",
				    	"destination": "{item.dimension.length}"
				    }
				}
	    	]
	    }
	},
	{
	    "type": "AddressInput",
	    "content": {
	    	"title": "Where",
			"value": "{formatAddress(item.address)}",
	    	"action_title": "Change"
	    },
		"formatting": [{
	        "content": "value",
	        "format": "{formatAddress(item.address)}"
	    }],
	    "data": {
	        "source": "",
	        "destination": "{item.address}"
	    }
	}
]
```

### What would the first page of creating an item look like for the app
NB: An item would be attached along with the page which would include all the data for the rows... ?
```
[
	{
	    "type": "PhotoUpload",
	    "content": {
	        "icon": "::image_upload::",
	        "subtitle": "Add photos",
	        "content": "Photos: 2/10 - Chose your listing’s main photo first.",
			"image_ids": ["_image_id_", "_image_id_"]
	    },
		"formatting": [],
	    "data": {
	        "source": "",
	        "destination": "{item.photos}"
	    }
	},
	{
	    "type": "Input",
	    "content": {
        	"title": "Title",
	    	"placeholder": "My iPhone 20",
			"value": "Best fridge"
	    },
		"formatting": [{
	        "content": "placeholder",
	        "format": "{formatCurrency(item.price)}"
	    }],
	    "data": {
	        "source": "",
	        "destination": "{item.title}"
	    }
	},
	{
	    "type": "Input",
	    "content": {
        	"title": "Price",
	    	"placeholder": "$20.00",
			"value": "$15.00"
	    },
		"formatting": [{
	        "content": "placeholder",
	        "format": "{item.condition.value}"
	    }],
	    "data": {
	        "source": "",
	        "destination": "{item.price}"
	    }
	},
	{
	    "type": "Dropdown",
	    "content": {
	        "placeholder": "Condition",
			"value": "Used - Like New"
	    },
		"formatting": [{
	        "content": "placeholder",
	        "format": "{item.selling_reason.value}"
	    }],
	    "data": {
	        "source": "{conditions}",
	        "destination": "{item.condition}"
	    }
	},
	{
	    "type": "Dropdown",
	    "content": {
	        "placeholder": "Selling reason",
			"value": "No longer used"
	    },
		"formatting": [],
	    "data": {
	        "source": "{selling_reasons}",
	        "destination": "{item.selling_reason}"
	    }
	},
	{
	    "type": "ColumnContainer",
	    "content": {
			"title": "Dimensions",
	    	"children": [
	    		{
				    "type": "Input",
				    "content": {
						"title": "",
						"placeholder": "Width",
						"value": "5"
				    },
					"formatting": [{
				        "content": "placeholder",
				        "format": "{formatDimension(item.dimension.width)}"
				    }],
				    "data": {
				    	"source": "",
				    	"destination": "{item.dimension.width}"
				    }
				},
	    		{
				    "type": "Input",
				    "content": {
						"title": "",
				    	"placeholder": "Height",
						"value": "10"
				    },
					"formatting": [{
				        "content": "placeholder",
				        "format": "{formatDimension(item.dimension.height)}"
				    }],
				    "data": {
				    	"source": "",
				    	"destination": "{item.dimension.height}"
				    }
				},
	    		{
				    "type": "Input",
				    "content": {
						"title": "",
				    	"placeholder": "Length",
						"value": "20"
				    },
					"formatting": [{
				        "content": "placeholder",
				        "format": "{formatDimension(item.dimension.length)}"
				    }],
				    "data": {
				    	"source": "",
				    	"destination": "{item.dimension.length}"
				    }
				}
	    	]
	    }
	},
	{
	    "type": "AddressInput",
	    "content": {
	    	"title": "Where",
			"value": "23-25 Rosebery Avenue, 2018 NSW}",
	    	"action_title": "Change"
	    },
		"formatting": [{
	        "content": "value",
	        "format": "{formatAddress(item.address)}"
	    }],
	    "data": {
	        "source": "",
	        "destination": "{item.address}"
	    }
	}
]
```