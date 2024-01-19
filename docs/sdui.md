# SDUI Rows

See [types](./types.md) for custom types and definitions used below

### Missing or empty values
- Empty strings will be displayed as empty strings (they will NOT be ignored, but will essentially not be visible to the user)
- Missing keys will not be allowed (all keys/properties of a row are required)

### Formatting funtions
```
formatCurrency(_variable_type_price_)
Variable: { "currency": "AUD", "value": "13.23" }
Outputs: $13.23
```
```
formatDate(_variable_type_timestamp_, "MM/DD/YYYY")
Variable: 1705651372
Outputs: 19/01/2024
```
```
formatAddress(_variable_type_address_)
Variable: {
    "unit": "23-25"
    "street": "Rosebery Avenue",
    "city": "Rosebery",
    "postcode": "2018",
    "state": "NSW",
    "country": "Australia",
    "location": ...
}
Outputs: 23-25 Rosebery Avenue, 2018 Rosebery NSW
```
```
formatAddressLine1(_variable_type_address_)
Variable: { ... see above ...}
Outputs: 23-25 Rosebery Avenue
```
```
formatAddressLine2(_variable_type_address_)
Variable: { ... see above ...}
Outputs: 2018 Rosebery NSW
```

### Base schema template:

```
{
	type: "string",
	content: "object"
}
```

### Rows

```
{
    "type": "Carousel",
    "content": {
        "image_ids": "string[]"
    }
}
```

```
{
    "type": "Title",
    "content": {
        "title": "string",
        "title_detail": "string",
        "subtitle_1": "string",
        "subtitle_2": "string"
    }
}
```

```
{
    "type": "TimeslotPicker",
    "content": {
        "icon": "string",
        "subtitle": "string",
        "details": "string",
        "dates_with_timeslots": [
            {
                "header": "string",
                "date": "string",
                "timeslots": [
                    {
                        "timeslot": "string",
                        "available": "boolean"
                    }
                ]
            }
        ]
    }
}
```

```
{
    "type": "Text",
    "content": {
        "title": "string",
        "content": "string",
        "maxLines": "number"
    }
}
```

```
{
    "type": "Detail",
    "content": {
        "title": "string",
        "icon": "string",
        "subtitle": "string",
        "detail": "string"
    }
}
```

```
{
    "type": "Disclaimer",
    "content": {
        "icon": "string",
        "title": "string",
        "subtitle": "string"
    }
}
```

```
{
    "type": "Address",
    "content": {
        "title": "string",
        "line_1": "string",
        "line_2": "string",
        "location": "location"
    }
}
```

```
{
    "type": "PaymentOptions",
    "content": {
        "title": "string",
        "options": [
            {
                "icon": "string",
                "label": "string",
            },
        ],
    }
}
```

```
{
    "type": "SegmentedControl",
    "content": {
        "children": [
            {
                "title": "string",
                "children": "ROW[]",
            },
        ],
    }
}
```

```
{
    "type": "ContainerList",
    "content": {
        "children": "ROW[]"
    }
}
```

```
{
    "type": "PhotoUpload",
    "content": {
        "icon": "string",
        "subtitle": "string",
        "content": "string"
    },
    "action": {
        "output_variable": "string"
    }
}
```

```
{
    "type": "TextInput",
    "content": {
        "fields": [{
            "placeholder": "string"
        },{
            "placeholder": "string"
        },{
            "placeholder": "string"
        }]
    },
    "action": {
        "fields": [{
            "output_variable": "string"
        },{
            "output_variable": "string"
        },{
            "output_variable": "string"
        }]
    },
    "formatting": [{
        "content": "string",
        "format": "string",
    }],
}
```

```
{
    "type": "Dropdown",
    "content": {
        "placeholder": "string",
    },
    "action": {
        "output_variable": "string"
    },
    "formatting": [{
        "content": "string",
        "format": "string",
    }],
    "data": {
        "source": "string",
    }
}
```