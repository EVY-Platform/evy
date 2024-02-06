# SDUI Rows

### Base rules
* Empty strings will be displayed and will NOT be ignored, but will essentially not be visible to the user
* Missing keys will not be allowed, all keys/properties of a row are required)
* All strings can include:
    * **variables** surrounded with curley braces: "Hello {name}, how are you?"
    * **icons** surrounded with double colons: "EVY ::evy_icon:: is the best!"
    * **emojis** prefixed with a colon: "I like :dog a lot"

### Base schema that all rows inherit from:
```
{
    // The type of row that it is, see below
	type: "string",

    // Each key/value pair represents a line of content shown on a row
    // the key is the name, the value is what the content is or where it's from
	content: {
        "label": "value"
    }

    // Special prop that defines a placeholder text shown on a row instead
    // of it's content, which disapears/fades out when a condition is met
    "fading_placeholder": {
        "value": "string",
        "condition": "string"
    },

    // Format certain content props on user input
    "formatting": [{
        "content": "string",
        "format": "string"
    }]

    // Where the input data get sent for storage
    "destination": "string"

}
```

### Container rows
```
{
    "type": "ColumnContainer",
    "content": {
        "title": "string",
        "children": "ROW[]"
    }
}
```

### Display Rows
```
{
    "type": "Carousel",
    "content": {
        "child_rows": "ROW[]",
        "child_data": "string"
    }
}
```
```
{
    "type": "Image",
    "content": {
        "image_id": "string"
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
    "type": "Calendar",
    "content": {
        "dates_with_timeslots": [
            {
                "header": "string",
                "date": "string",
                "timeslots": [
                    {
                        "start_timestamp": "string",
                        "end_timestamp": "string",
                        "type": "string"
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

### Editable rows
```
{
    "type": "Info",
    "content": {
        "title": "string"
    }
}
```
```
{
    "type": "Input",
    "content": {
        "title": "string",
        "value": "string",
        "placeholder": "string"
    }
}
```
```
{
    "type": "Search",
    "content": {
        "title": "string",
        "value": "string",
        "placeholder": "string"
    }
}
```
```
{
    "type": "SearchMulti",
    "content": {
        "title": "string",
        "values": "string[]",
        "placeholder": "string"
    }
}
```
```
{
    "type": "AddressInput",
    "content": {
        "title": "string",
        "value": "string",
        "action_title": "string"
    }
}
```
```
{
    "type": "PhotoUpload",
    "content": {
        "icon": "string",
        "subtitle": "string",
        "content": "string",
        "image_ids": "string",
    }
}
```
```
{
    "type": "Select",
    "content": {
        "placeholder": "string",
        "value": "string"
    }
}
```
```
{
    "type": "Wheel",
    "content": {
        "value": "string"
    }
}
```