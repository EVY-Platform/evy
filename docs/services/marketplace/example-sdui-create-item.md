# SDUI example for create item page

### In the database
```
[
	{
	    "type": "PhotoUpload",
	    "view": {
			"content": {
	        	"icon": "::image_upload::",
	        	"subtitle": "Add photos",
	        	"content": "Photos: {count(item.photos)}/10 - Chose your listing’s main photo first.",
				"photos": "{item.photos}"
			}
	    },
		"edit": {
	    	"destination": "{item.photos}"
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
			"formatting": {
				"data": "{item.title}",
				"format": "{input}"
			},
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
			"formatting": {
				"data": "{item.price}",
				"format": "{formatCurrency(input)}"
			},
	        "destination": "{item.price}"
	    }
	},
	{
	    "type": "Select",
	    "view": {
			"content": {
	        	"placeholder": "Condition",
				"value": "{item.condition.value}",
				"options": "{conditions}"
	    	}
		},
		"edit": {
			"formatting": {
				"data": "{item.condition}",
				"format": "{input.value}"
			},
	        "destination": "{item.condition}"
	    }
	},
	{
	    "type": "Select",
	    "view": {
			"content": {
	        	"placeholder": "Selling reason",
				"value": "{item.selling_reason.value}",
				"options": "{selling_reasons}"
	    	}
		},
		"edit": {
			"formatting": {
				"data": "{item.selling_reason}",
				"format": "{input.value}"
			},
	        "destination": "{item.selling_reason}"
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
						"formatting": {
							"data": "{item.dimension.width}",
							"format": "{formatDimension(input)}"
						},
						"destination": "{item.dimension.width}"
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
						"formatting": {
							"data": "{item.dimension.height}",
							"format": "{formatDimension(input)}"
						},
						"destination": "{item.dimension.height}"
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
						"formatting": {
							"data": "{item.dimension.length}",
							"format": "{formatDimension(input)}"
						},
						"destination": "{item.dimension.length}"
					}
				}]
			}
		}
	},
	{
	    "type": "ActionRow",
	    "view": {
			"content": {
				"title": "Where",
				"value": "{formatAddress(item.address)}",
				"action_title": "Change"
			},
			"placeholder": {
				"value": "Enter an address for pickup",
				"condition": "{item.address}"
			}
	    },
		"edit": {
			"formatting": {
				"data": "{item.address}",
				"format": "{formatAddress(input)}"
			},
	        "destination": "{item.address}"
	    }
	},
	{
	    "type": "Wheel",
	    "view": {
			"content": {
				"value": "{formatDuration(timeslot_duration)}",
				"options": "{timeslot_durations}"
			}
	    },
		"edit": {
			"formatting": {
				"data": "{timeslot_duration}",
				"format": "{formatDuration(input)}"
			},
	        "destination": "{timeslot_duration}"
	    }
	},
	{
		"type": "Calendar",
		"view": {
			"content": {
				"transfer_options": "{item.transfer_options}",
			}
		},
		"edit": {
			"destination": "{item.transfer_options}"
		}
	},
	{
	    "type": "Search",
	    "view": {
			"content": {
				"title": "Address",
				"value": "{formatAddress(item.address)}",
				"placeholder": "Type address",
				"data": "{api_address_search}",
			}
	    },
		"edit": {
			"formatting": {
				"data": "{item.address}",
				"format": "{formatAddress(input)}"
			},
	        "destination": "{item.address}"
	    }
	},
	{
	    "type": "SearchMulti",
	    "view": {
			"content": {
				"title": "Tags",
				"values": "{item.tags[].value}",
				"placeholder": "Outdoor, Furniture, etc",
				"data": "{tags}"
			}
	    },
		"edit": {
			"formatting": {
				"data": "{item.tags}",
				"format": "{input.value}"
			},
	        "destination": "{item.tags}"
	    }
	}
]
```

### Sent to the app
```
[
	{
	    "type": "PhotoUpload",
	    "view": {
			"content": {
				"icon": "::image_upload::",
				"subtitle": "Add photos",
				"content": "Photos: 2/10 - Chose your listing’s main photo first.",
				"photos": "[{"id": "_image_id_"}, {"id": "_image_id_"}]"
			}
		},
	    "edit":{
	        "destination": "{item.photos}"
	    }
	},
	{
	    "type": "Input",
	    "view": {
			"content": {
				"title": "Title",
				"placeholder": "My iPhone 20",
				"value": "Best fridge"
			}
		},
	    "edit": {
			"formatting": {
				"data": "{item.title}",
				"format": "{input}"
			},
	        "destination": "{item.title}"
	    }
	},
	{
	    "type": "Input",
	    "view": {
			"content": {
        		"title": "Price",
				"placeholder": "$20.00",
				"value": "$15.00"
			}
		},
	    "edit": {
			"formatting": {
				"data": "{item.price}",
				"format": "{formatCurrency(input)}"
			},
	        "destination": "{item.price}"
	    }
	},
	{
	    "type": "Select",
	    "view": {
			"content": {
				"placeholder": "Condition",
				"value": "Used - Like New",
				"options": "{conditions}"
			}
		},
	    "edit": {
			"formatting": {
				"data": "{item.condition}",
				"format": "{input.value}"
			},
	        "destination": "{item.condition}"
	    }
	},
	{
	    "type": "Select",
	    "view": {
			"content": {
				"placeholder": "Selling reason",
				"value": "No longer used",
				"options": "{selling_reasons}"
			}
		},
	    "edit": {
			"formatting": {
				"data": "{item.selling_reason}",
				"format": "{input.value}"
			},
	        "destination": "{item.selling_reason}"
	    }
	},
	{
	    "type": "ColumnContainer",
	    "view": {
			"content": {
				"title": "Dimensions",
				"children": [{
					"type": "Input",
					"view": {
						"content": {
							"title": "",
							"placeholder": "Width",
							"value": "5"
						}
					},
					"edit": {
						"formatting": {
							"data": "{item.dimension.width}",
							"format": "{formatDimension(input)}"
						},
						"destination": "{item.dimension.width}"
					}
				},
				{
					"type": "Input",
					"view": {
						"content": {
							"title": "",
							"placeholder": "Height",
							"value": "10"
						}
					},
					"edit": {
						"formatting": {
							"data": "{item.dimension.height}",
							"format": "{formatDimension(input)}"
						},
						"destination": "{item.dimension.height}"
					}
				},
				{
					"type": "Input",
					"view": {
						"content": {
							"title": "",
							"placeholder": "Length",
							"value": "20"
						}
					},
					"edit": {
						"formatting": {
							"data": "{item.dimension.length}",
							"format": "{formatDimension(input)}"
						},
						"destination": "{item.dimension.length}"
					}
				}]
			}
		}
	},
	{
	    "type": "ActionRow",
	    "view": {
			"content": {
				"title": "Where",
				"value": "23-25 Rosebery Avenue, 2018 NSW",
				"action_title": "Change"
			},
			"placeholder": {
				"value": "Enter an address for pickup",
				"condition": "{item.address}"
			}
		},
	    "edit": {
			"formatting": {
				"data": "{item.address}",
				"format": "{formatAddress(input)}"
			},
	        "destination": "{item.address}"
	    }
	},
	{
	    "type": "Wheel",
	    "view": {
			"content": {
				"value": "{15 minutes}"
	        	"options": "{timeslot_durations}",
			}
		},
	    "edit": {
			"formatting": {
				"data": "{timeslot_duration}",
				"format": "{formatDuration(input)}"
			},
	        "destination": "{timeslot_duration}"
	    }
	},
	{
		"type": "Calendar",
		"view": {
			"content": {
				"transfer_options": {
					"pickup": {
						"timeslots": [
							{
								"start_timestamp": "1700894934",
								"end_timestamp": "1700895934",
								"available": true,
								"type": "pickup"
							},
							{
								"start_timestamp": "1700894934",
								"end_timestamp": "1700895934",
								"available": false,
								"type": "pickup"
							},
							{
								"start_timestamp": "1700894934",
								"end_timestamp": "1700895934",
								"available": true,
								"type": "pickup"
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
								"start_timestamp": "1700894934",
								"end_timestamp": "1700895934",
								"available": true,
								"type": "delivery"
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
				}
			}
		},
		"edit": {
			"destination": "{item.transfer_options}"
		}
	},
	{
	    "type": "Search",
	    "view": {
			"content": {
				"title": "Address",
				"value": "23-25 Rosebery Avenue, 2018 NSW",
				"placeholder": "Type address",
	        	"data": "{api_address_search}"
			}
		},
	    "edit": {
			"formatting": {
				"data": "{item.address}",
				"format": "{formatAddress(input)}"
			},
	        "destination": "{item.address}"
	    }
	},
	{
	    "type": "SearchMulti",
	    "view": {
			"content": {
				"title": "Tags",
				"values": "Furniture, Chair",
				"placeholder": "Outdoor, Furniture, etc",
				"data": "[{"id": "a", "value": "Furniture"}, {"id": "b", "value": "Chair"}]"
			}
		},
	    "edit": {
			"formatting": {
				"data": "{item.tags}",
				"format": "{input.value}"
			},
	        "destination": "{item.tags}"
	    }
	}
]
```
