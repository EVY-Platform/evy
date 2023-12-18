# SDUI Rows

See [types](./types.md) for custom types and definitions used below

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
        "photo_ids": "string[]"
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
