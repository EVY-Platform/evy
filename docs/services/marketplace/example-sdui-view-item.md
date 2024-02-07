# SDUI example for view item page

### In the database for that page
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
				"line_2": "{formatAddressLine2(item.address)}"
			}
		}
	},
	{
		"type": "PaymentOptions",
		"view": {
			"content": {
				"title": "Payment methods accepted",
				"options": [{
					"icon": "_image_id_",
					"label": "Card",
					"disclaimer": "::lock:: Benefit from EVY buyer protection",
					"enabled": "{item.payment_methods.find('card')}"
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
				}]
			}
		}
	}
]
```

### Sent to the app for a sample item
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
							"image_id": "_image_id_1_"
						}
					}
				},{
					"type": "Image",
					"view": {
						"content": {
							"image_id": "_image_id_2_"
						}
					}
				}]
			}
		}
	},
	{
		"type": "Title",
		"view": {
			"content": {
				"title": "Amazing Fridge",
				"title_detail": "$250",
				"subtitle_1": "::star_doc:: 88% - 4 items sold",
				"subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
			}
		}
	},
	{
		"type": "SegmentedControl",
		"view": {
			"content": {
				"children": [{
					"title": "Pickup",
					"children": [{
						"type": "TimeslotPicker",
						"view": {
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
						}
					}]
				},
				{
					"title": "Deliver",
					"children": [{
						"type": "TimeslotPicker",
						"view": {
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
						}
					}]
				},
				{
					"title": "Ship",
					"children": [{
						"type": "Detail",
						"view": {
							"content": {
								"title": "Australia Post",
								"icon": "_image_id_",
								"subtitle": "2-5 days once deposited",
								"details": "$25.00"
							}
						}
					},
					{
						"type": "Disclaimer",
						"view": {
							"content": {
								"icon": "_image_id_",
								"title": "EVY Protection",
								"subtitle": "Your money will be held until Australia Post confirms delivery"
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
				"content": "Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place.",
				"maxLines": "2"
			}
		}
	},
	{
		"type": "ContainerList",
		"view": {
			"content": {
			"children": [{
				"type": "Detail",
				"view": {
					"content": {
						"icon": "_image_id_",
						"title": "Selling reason",
						"subtitle": "Moving out",
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
						"subtitle": "250 (w) x 120 (h) x 250 (l)",
						"detail": ""
					}
				}
			},
			{
				"type": "Detail",
				"view": {
					"content": {
						"icon": "_image_id_",
						"title": "Condition",
						"subtitle": "Like new",
						"detail": ""
					}
				}
			}]
		}
	},
	{
		"type": "Address",
		"view": {
			"content": {
				"title": "Pickup location",
				"line_1": "23-25 Rosebery Avenue",
				"line_2": "2018 Rosebery, NSW",
				"location": {
					"latitude": 45.323124,
					"longitude": -3.424233
				}
			}
		}
	},
	{
		"type": "PaymentOptions",
		"view": {
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
	}
]
```