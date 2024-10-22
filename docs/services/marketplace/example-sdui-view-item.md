# SDUI example for view item page

```
[
	{
		"type": "CarouselContainer",
		"view": {
			"content": {
				"children": [{
					"title": "",
					"child": {
						"type": "Image",
						"view": {
							"content": {
								"image_id": "{input.id}"
							}
						}
					}
				}],
				"children_data": "{item.photo_ids}"
			}
		}
	},
	{
		"type": "Title",
		"view": {
			"content": {
				"title": "{item.title}",
				"title_detail": "{formatCurrency(item.price)}",
				"line_1": "::star_doc::{item.seller.fidelity_rating}% - {item.seller.items_sold} items sold",
				"line_2": "{item.address.city}, {item.address.state} -  Posted on {formatTimestamp(item.created_timestamp, 'MM DD')}"
			}
		}
	},
	{
		"type": "SelectSegmentContainer",
		"view": {
			"content": {
				"children": [{
					"title": "Pickup",
					"child": {
						"type": "TimeslotPicker",
						"view": {
							"content": {
								"title": "",
								"icon": "_image_id_",
								"subtitle": "Meet at the pickup location",
								"details": "",
								"timeslots": "{item.transfer_option.pickup.timeslots}"
							}
						}
					}
				},
				{
					"title": "Delivery",
					"child": {
						"type": "TimeslotPicker",
						"view": {
							"content": {
								"title": "",
								"icon": "_image_id_",
								"details": "+ formatCurrency(item.transfer_option.delivery.fee)",
								"subtitle": "Delivered at your door",
								"timeslots": "{item.transfer_option.delivery.timeslots}"
							}
						}
					}
				},
				{
					"title": "Shipping",
					"children": [{
						"type": "Detail",
						"view": {
							"content": {
								"title": "",
								// This is usually fetched from API
								"icon": "{transfer_provider.logo_id}",
								"line_1": "{transfer_provider.name}",
								"line_2": "{transfer_provider.eta}",
								"detail": "{formatCurrency(item.transfer_option.shipping.fee + transfer_provider.fee)}"
							}
						}
					},
					{
						"type": "Disclaimer",
						"view": {
							"content": {
								"title": "EVY Protection",
								"icon": "_image_id_",
								"disclaimer": "Your money will be held until {transfer_provider.name} confirms delivery"
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
				"text": "{item.description}"
			},
			"maxLines": "2"
		}
	},
	{
		"type": "ListContainer",
		"view": {
			"content": {
				"title": "",
				"children": [{
					"title": "",
					"child": {
						"type": "Detail",
						"view": {
							"content": {
								"icon": "_image_id_",
								"line_1": "Condition",
								"line_2": "{item.condition.value}",
								"detail": ""
							}
						}
					}
				},
				{
					"title": "",
					"child": {
						"type": "Detail",
						"view": {
							"content": {
								"icon": "_image_id_",
								"line_1": "Selling reason",
								"line_2": "{item.selling_reason.value}",
								"detail": ""
							}
						}
					}
				},
				{
					"title": "",
					"child": {
						"type": "Detail",
						"view": {
							"content": {
								"icon": "_image_id_",
								"line_1": "Dimensions",
								"line_2": "{item.dimension.width} (w) x {item.dimension.height} (h) x {item.dimension.length} (l)",
								"detail": ""
							}
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
		"type": "ListContainer",
		"view": {
			"content": {
				"title": "Payment methods accepted",
				"children": [{
					"title": "",
					"child": {
						"type": "TitleShort",
						"view": {
							"content": {
								"title": "",
								"icon": "_image_id_",
								"detail": "Card",
								"disclaimer": "::lock:: Benefit from EVY buyer protection"
							}
						}
					}
				},
				{
					"title": "",
					"child": {
						"type": "TitleShort",
						"view": {
							"content": {
								"title": "",
								"icon": "_image_id_",
								"detail": "Bank",
								"disclaimer": "::lock:: Benefit from EVY buyer protection"
							}
						}
					}
				},
				{
					"title": "",
					"child": {
						"type": "TitleShort",
						"view": {
							"content": {
								"title": "",
								"icon": "_image_id_",
								"detail": "Cash",
								"disclaimer": ""
							}
						}
					}
				}]
			}
		}
	}
]
```
