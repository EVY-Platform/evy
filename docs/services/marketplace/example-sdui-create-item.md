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
				"photos": "{item.photos[]}"
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
						"destination": "{item.dimension.length}"
					}
				}]
			}
		}
	},
	{
	    "type": "SheetRow",
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
	        "destination": "{timeslot_duration}"
	    }
	},
	{
		"type": "Calendar",
		"view": {
			"content": {
				"transfer_options": "{item.transfer_options}"
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
				"photos": "{item.photos[]}"
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
				"value": "{item.title}"
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
				"placeholder": "$20.00",
				"value": "formatCurrency(item.price)"
			}
		},
	    "edit": {
	        "destination": "{item.price}"
	    }
	},
	{
	    "type": "Select",
	    "view": {
			"content": {
				"placeholder": "Condition",
				"value": "item.condition.value",
				"options": "{conditions}"
			}
		},
	    "edit": {
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
							"value": "formatDimension(item.dimension.width)"
						}
					},
					"edit": {
						"destination": "{item.dimension.width}"
					}
				},
				{
					"type": "Input",
					"view": {
						"content": {
							"title": "",
							"placeholder": "Height",
							"value": "formatDimension(item.dimension.height)"
						}
					},
					"edit": {
						"destination": "{item.dimension.height}"
					}
				},
				{
					"type": "Input",
					"view": {
						"content": {
							"title": "",
							"placeholder": "Length",
							"value": "formatDimension(item.dimension.length)"
						}
					},
					"edit": {
						"destination": "{item.dimension.length}"
					}
				}]
			}
		}
	},
	{
	    "type": "SheetRow",
	    "view": {
			"content": {
				"title": "Where",
				"value": "formatAddress(item.address)",
				"action_title": "Change"
			},
			"placeholder": {
				"value": "Enter an address for pickup",
				"condition": "{item.address}"
			}
		},
	    "edit": {
	        "destination": "{item.address}"
	    }
	},
	{
	    "type": "Wheel",
	    "view": {
			"content": {
				"value": "formatDuration(timeslot_duration)"
	        	"options": "{timeslot_durations}",
			}
		},
	    "edit": {
	        "destination": "{timeslot_duration}"
	    }
	},
	{
		"type": "Calendar",
		"view": {
			"content": {
				"transfer_options": "{item.transfer_options}"
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
				"value": "formatAddress(item.address)",
				"placeholder": "Type address",
	        	"data": "{api_address_search}"
			}
		},
	    "edit": {
	        "destination": "{item.address}"
	    }
	},
	{
	    "type": "SearchMulti",
	    "view": {
			"content": {
				"title": "Tags",
				"values": "{item.tags.value}",
				"placeholder": "Outdoor, Furniture, etc",
				"data": "[{"id": "a", "value": "Furniture"}, {"id": "b", "value": "Chair"}]"
			}
		},
	    "edit": {
	        "destination": "{item.tags}"
	    }
	}
]
```
