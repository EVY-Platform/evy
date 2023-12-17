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
        "icon": "icon",
        "subtitle": "string",
        "details": "string",
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
        "content": "string"
    }
}
```

```
{
    "type": "Detail",
    "content": {
        "title": "string",
        "logo": "image",
        "subtitle": "string",
        "detail": "string"
    }
}
```

```
{
    "type": "Disclaimer",
    "content": {
        "icon": "icon",
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
                "icon": "icon",
                "label": "string",
            },
        ],
    }
}
```
