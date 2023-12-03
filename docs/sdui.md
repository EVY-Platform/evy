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
        "timeslots": [
            {
                "timeslot": "number",
                "available": "boolean",
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
                "child": "ROW",
            },
        ],
    }
}
```

```
{
    "type": "ContentShort",
    "content": {
        "title": "string",
        "content": "string"
    }
}
```

```
{
    "type": "ContentLong",
    "content": {
        "title": "string",
        "logo": "image",
        "subtitle": "string",
        "detail": "string",
        "disclaimer": "string"
    }
}
```

```
{
    "type": "Condition",
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
                "disclaimer": "string",
            },
        ],
    }
}
```
