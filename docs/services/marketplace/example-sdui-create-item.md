# SDUI example for create item page

### In the database
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
	    "type": "Select",
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
	    "type": "Select",
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
	    },
		"fading_placeholder": {
			"value": "Enter an address for pickup",
			"condition": "{item.address}"
		}
	},
	{
	    "type": "Wheel",
	    "content": {
			"value": "{formatDuration(timeslot_duration)}"
	    },
		"formatting": [{
	        "content": "value",
	        "format": "{formatDuration(timeslot_duration)}"
	    }],
	    "data": {
	        "source": "{timeslot_durations}",
	        "destination": "{timeslot_duration}"
	    }
	},
	{
		"type": "Calendar",
		"content": {},
		"data": {
			"source": "{item.transfer_option}",
			"destination": "{item.transfer_option}"
		}
	},
	{
	    "type": "Search",
	    "content": {
	    	"title": "Address",
			"value": "{formatAddress(item.address)}",
	    	"placeholder": "Type address"
	    },
		"formatting": [{
	        "content": "value",
	        "format": "{formatAddress(item.address)}"
	    }],
	    "data": {
	        "source": "{places_search}",
	        "destination": "{item.address}"
	    }
	},
	{
	    "type": "SearchMulti",
	    "content": {
	    	"title": "Tags",
			"values": "{item.tags[].value}",
	    	"placeholder": "Outdoor, Furniture, etc"
	    },
		"formatting": [],
	    "data": {
	        "source": "",
	        "destination": "{item.tags}"
	    }
	}
]
```

### Sent to the app
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
	    "type": "Select",
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
	    "type": "Select",
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
	    },
		"fading_placeholder": {
			"value": "Enter an address for pickup",
			"condition": "{item.address}"
		}
	},
	{
	    "type": "Wheel",
	    "content": {
			"value": "{15 minutes}"
	    },
		"formatting": [{
	        "content": "value",
	        "format": "{formatDuration(timeslot_duration)}"
	    }],
	    "data": {
	        "source": "{timeslot_durations}",
	        "destination": "{timeslot_duration}"
	    }
	},
	{
		"type": "Calendar",
		"content": {
			"dates_with_timeslots": [
				{
					"header": "Wed",
					"date": "8 nov.",
					"timeslots": [
						{
							"start_timestamp": "1700894934",
							"end_timestamp": "1700895934",
							"type": "pickup"
						},
						{
							"start_timestamp": "1700895934",
							"end_timestamp": "1700896934",
							"type": "delivery"
						},
						{
							"start_timestamp": "1700884934",
							"end_timestamp": "1700899934",
							"type": "pickup"
						}
					]
				},
				{
					"header": "Thu",
					"date": "9 nov.",
					"timeslots": [
						{
							"start_timestamp": "1700894934",
							"end_timestamp": "1700895934",
							"type": "pickup"
						}
					]
				}
			]
		},
		"data": {
			"source": "{item.transfer_option}",
			"destination": "{item.transfer_option}"
		}
	},
	{
	    "type": "Search",
	    "content": {
	    	"title": "Address",
			"value": "23-25 Rosebery Avenue, 2018 NSW",
	    	"placeholder": "Type address"
	    },
		"formatting": [{
	        "content": "value",
	        "format": "{formatAddress(item.address)}"
	    }],
	    "data": {
	        "source": "{places_search}",
	        "destination": "{item.address}"
	    }
	},
	{
	    "type": "SearchMulti",
	    "content": {
	    	"title": "Tags",
			"values": "Furniture, Chair",
	    	"placeholder": "Outdoor, Furniture, etc"
	    },
		"formatting": [],
	    "data": {
	        "source": "",
	        "destination": "{item.tags}"
	    }
	}
]
```
