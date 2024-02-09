# Data example for marketplace

### Conditions
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

### Selling reasons
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

### Provider
```
{
	"id": "post_office_id",
	"name": "Australia Post",
	"logo_id": "_image_id_",
	"cost": {
		"currency": "AUD",
		"value": 15.00
	},
}
```

### Booking
```
{
	"item_id": "x",
	"timeslot": "1700894934",
	"buyer_id": "a"
}
```

### Item
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
