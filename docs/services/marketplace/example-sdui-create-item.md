# SDUI example for create item page

```
{
	"id": "create_item",
	"name": "Create item",
	"type": "create",
	"pages": [PAGE]
}
```

```
{
	"id": "create_item_step_1",
	"title": "Step 1",
	"rows": [
		{
			"type": "SelectPhoto",
			"view": {
				"content": {
					"title": "",
					"icon": "::image_something::",
					"subtitle": "Add photos",
					"content": "Photos: {count(item.photo_ids)}/10 - Chose your listing’s main photo first.",
					"photos": "{item.photo_ids}"
				}
			},
			"edit": {
				"destination": "{item.photo_ids}"
			}
		},
		{
			"type": "Input",
			"view": {
				"content": {
					"title": "Title",
					"value": "{item.title}",
					"placeholder": "My iPhone 20"
				}
			},
			"edit": {
				"destination": "{item.title}"
			}
		},
		{
			"type": "Input",
			"view": {
				"content": {
					"title": "Price",
					"value": "{formatCurrency(item.price)}",
					"placeholder": "$20.00"
				}
			},
			"edit": {
				"destination": "{item.price}",
				"minimum_number": "1"
			}
		},
		{
			"type": "SheetContainer",
			"view": {
				"content": {
					"title": "Condition",
					"child": {
						"type": "Input",
						"view": {
							"content": {
								"title": "",
								"placeholder": "Chose one",
								"value": "{item.condition.value}"
							}
						}
					},
					"children": [{
						"type": "Dropdown",
						"view": {
							"content": {
								"value": "{item.condition.value}",
								"placeholder": "Choose one"
							},
							"data": "{conditions}"
						},
						"edit": {
							"destination": "{item.condition}"
						}
					}]
				}
			}
		},
		{
			"type": "SheetContainer",
			"view": {
				"content": {
					"title": "Selling reason",
					"child": {
						"type": "Input",
						"view": {
							"content": {
								"title": "",
								"placeholder": "Chose one",
								"value": "{item.selling_reason.value}"
							}
						}
					},
					"children": [{
						"type": "Dropdown",
						"view": {
							"content": {
								"title": "Selling Reason",
								"value": "{item.selling_reason.value}",
								"placeholder": "Choose one"
							},
							"data": "{selling_reasons}"
						},
						"edit": {
							"destination": "{item.selling_reason}"
						}
					}]
				}
			}
		},
		{
			"type": "ColumnContainer",
			"title": "Dimensions",
			"view": {
				"content": {
					"children": [{
						"type": "Input",
						"view": {
							"content": {
								"title": "",
								"placeholder": "Width",
								"value": "{formatDimension(item.dimension.width)}"
							}
						},
						"edit": {
							"destination": "{item.dimension.width}",
							"minimum_number": "1"
						}
					},
					{
						"type": "Input",
						"view": {
							"content": {
								"title": "",
								"placeholder": "Height",
								"value": "{formatDimension(item.dimension.height)}"
							}
						},
						"edit": {
							"destination": "{item.dimension.height}",
							"minimum_number": "1"
						}
					},
					{
						"type": "Input",
						"view": {
							"content": {
								"title": "",
								"placeholder": "Length",
								"value": "{formatDimension(item.dimension.length)}"
							}
						},
						"edit": {
							"destination": "{item.dimension.length}",
							"minimum_number": "1"
						}
					}]
				}
			}
		},
		{
			"type": "SheetContainer",
			"view": {
				"content": {
					"title": "Where",
					"child": {
						"type": "Title"
						"view": {
							"content": {
								"title": "Where",
								"line_1": "{formatAddress(item.address)}",
								"line_2": "",
								"title_detail": "Change"
							}
						}
					}
					"children": [{
						"type": "Search",
						"view": {
							"content": {
								"title": "",
								"value": "formatAddress(item.address)",
								"placeholder": "Type your address"
							},
							"multi": "{false}"
							"data": "google_place_api"
						},
						"edit": {
							"destination": "{item.address}"
						}
					},
					{
						"type": "Input",
						"view": {
							"content": {
								"title": "Additional Information",
								"placeholder": "Buzz code, Take the elevator, etc",
								"value": "{item.address.instructions}"
							}
						},
						"edit": {
							"destination": "{item.address.instructions}"
						}
					}]
				}
			}
		},
		{
			"type": "InlinePicker",
			"view": {
				"content": {
					"title": "",
					"value": "{formatDuration(timeslot_duration)}"
				},
				"data": "{timeslot_durations}"
			},
			"edit": {
				"destination": "{timeslot_duration}"
			}
		},
		{
			"type": "SelectSegmentContainer",
			"view": {
				"content": {
					"children": [{
						"title": "Pickup",
						"child": {
							"type": "Calendar",
							"view": {
								"content": {
									"layers": [{
										"primary": "{selected_transfer_option === 'pickup'}",
										"timeslots": "{item.transfer_option.pickup.timeslots}"
									},{
										"primary": "{selected_transfer_option === 'delivery'}",
										"timeslots": "{item.transfer_option.delivery.timeslots}"
									}]
								}
							},
							"edit": {
								"destination": "{item.transfer_options.pickup}",
								"minimum_number": "1"
							}
						}
					},{
						"title": "Delivery",
						"child": {
							"type": "Calendar",
							"view": {
								"content": {
									"layers": [{
										"primary": "{selected_transfer_option === 'delivery'}",
										"timeslots": "{item.transfer_option.delivery.timeslots}"
									},{
										"primary": "{selected_transfer_option === 'pickup'}",
										"timeslots": "{item.transfer_option.pickup.timeslots}"
									}]
								}
							},
							"edit": {
								"destination": "{item.transfer_options.delivery}",
								"minimum_number": "1"
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
			"type": "SheetContainer",
			"view": {
				"content": {
					"title": "Tags",
					"child": {
						"type": "InputList",
						"view": {
							"content": {
								"title": "Tags",
								"placeholder": "Search for tags",
								"value": "{item.tags}"
							}
						}
					},
					"children": [{
						"type": "Search",
						"view": {
							"content": {
								"title": "",
								"value": "{tag[].value}",
								"placeholder": "Search for tags"
							},
							"data": "{api:tags}"
						},
						"edit": {
							"destination": "{item.tags}"
						}
					}]
				}
			}
		}
	],
	"footer": {
		"type": "Button",
		"view": {
			"content": {
				"title": "",
				"label": "Next"
			}
		},
		"edit": {},
		"action": {
			"target": "navigate:create_item:create_item_step_2"
		}
	}
}
```

```
{
	"id": "create_item_step_2",
	"title": "Step 2",
	"rows": [
		{
			"type": "TextArea",
			"view": {
				"content": {
					"title": "",
					"value": "{item.description}",
					"placeholder": "Model xyz, super cool item I love it"
				}
			},
			"edit": {
				"destination": "{item.description}",
			}
		}
	],
	"footer": {
		"type": "Button",
		"view": {
			"content": {
				"title": "",
				"label": "Next"
			}
		},
		"edit": {},
		"action": {
			"target": "submit:item"
		}
	}
}
```
