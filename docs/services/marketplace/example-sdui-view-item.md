# SDUI example for view item page

```
[
	{
		"type": "Carousel",
		"view": {
			"content": {
				"children_rows": [{
					"type": "Image",
					"view": {
						"content": {
							"image_id": "{input.id}"
						}
					}
				}],
				"children_data": "{item.photos}"
			}
		}
	},
	{
		"type": "Title",
		"view": {
			"content": {
				"title": "{item.title}",
				"title_detail": "{formatCurrency(item.price)}",
				"subtitle_1": "::star_doc::{item.seller.fidelity_rating}% - {item.seller.items_sold} items sold",
				"subtitle_2": "{item.address.city}, {item.address.state} -  Posted on {formatTimestamp(item.created_timestamp, 'MM DD')}"
			}
		}
	},
	{
		"type": "SegmentedControl",
		"view": {
			"content": {
				"children": [{
					"title": "Pickup",
					"enabled": "{item.transfer_option.pickup && count(item.transfer_option.pickup.dates_with_timeslots) > 0}",
					"child": {
						"type": "TimeslotPicker",
						"view": {
							"content": {
								"icon": "_image_id_",
								"details": "",
								"subtitle": "Meet at the pickup location",
								"timeslots": "{item.transfer_option.pickup.timeslots}"
							}
						}
					}
				},
				{
					"title": "Deliver",
					"enabled": "{item.transfer_option.delivery && count(item.transfer_option.delivery.dates_with_timeslots) > 0}",
					"child": {
						"type": "TimeslotPicker",
						"view": {
							"content": {
								"icon": "_image_id_",
								"details": "+ formatCurrency(item.transfer_option.delivery.fee)",
								"subtitle": "Delivered at your door",
								"timeslots": "{item.transfer_option.delivery.timeslots}"
							}
						}
					}
				},
				{
					"title": "Ship",
					"enabled": "{item.transfer_option.ship.transfer_provider}",
					"children": [{
						"type": "Detail",
						"view": {
							"content": {
								// This is usually fetched from API
								"title": "{transfer_provider.name}",
								"icon": "{transfer_provider.logo_id}",
								"subtitle": "{transfer_provider.eta}",
								"details": "{formatCurrency(item.transfer_option.ship.fee + transfer_provider.fee)}"
							}
						}
					},
					{
						"type": "Disclaimer",
						"view": {
							"content": {
								"icon": "_image_id_",
								"title": "EVY Protection",
								"subtitle": "Your money will be held until {transfer_provider.name} confirms delivery"
							}
						}
					}]
				}]
			}
		}
	},
	{
		"type": "Text",
		"view": {
			"content": {
				"title": "Description",
				"content": "{item.description}",
				"maxLines": "2"
			}
		}
	},
	{
		"type": "ContainerList",
		"view": {
			"content": {
				"title": "",
				"children": [{
					"type": "Detail",
					"view": {
						"content": {
							"icon": "_image_id_",
							"title": "Condition",
							"subtitle": "{item.condition.value}",
							"detail": ""	
						}
					}
				},
				{
					"type": "Detail",
					"view": {
						"content": {
							"icon": "_image_id_",
							"title": "Selling reason",
							"subtitle": "{item.selling_reason.value}",
							"detail": ""
						}
					}
				},
				{
					"type": "Detail",
					"view": {
						"content": {
							"icon": "_image_id_",
							"title": "Dimensions",
							"subtitle": "{item.dimension.width} (w) x {item.dimension.height} (h) x {item.dimension.length} (l)",
							"detail": ""
						}
					}
				}]
			}
		}
	},
	{
		"type": "Address",
		"view": {
			"content": {
				"title": "Pickup location",
				"line_1": "{formatAddressLine1(item.address)}",
				"line_2": "{formatAddressLine2(item.address)}",
				"location": "{item.address.location}"
			}
		}
	},
	{
		"type": "ContainerList",
		"view": {
			"content": {
				"title": "Payment methods accepted",
				"children": [{
					"type": "TitleShort",
					"view": {
						"content": {
							"icon": "_image_id_",
							"title": "Card",
							"disclaimer": "::lock:: Benefit from EVY buyer protection"
						}
					}
				},
				{
					"type": "TitleShort",
					"view": {
						"content": {
							"icon": "_image_id_",
							"title": "Bank",
							"disclaimer": "::lock:: Benefit from EVY buyer protection"
						}
					}
				},
				{
					"type": "TitleShort",
					"view": {
						"content": {
							"icon": "_image_id_",
							"title": "Cash",
							"disclaimer": ""
						}
					}
				}]
			}
		}
	}
]
```
