# SDUI Rows

### Base features
* All strings can include:
    * **variables** surrounded with curley braces: "Hello {name}, how are you?"
    * **icons** surrounded with double colons: "EVY ::evy_icon:: is the best!"
    * **emojis** prefixed with a colon: "I like :dog a lot"
* []
    * Denotes an array variable, used as such: string[] or int[]
    * Can have no type which denotes "any"
* Content inside of row.view (see below)
    * Empty strings will be displayed and will NOT be ignored, but will essentially not be visible to the user
    * Missing keys will not be allowed, all keys/properties of a row content are required

### Base schema that all rows inherit from:
```
{
    // The type of row that it is, see below
    type: "string",

    "view": {
        // Each key/value pair represents a line of content shown on a row
        // the key is the name, the value is what the content is or where it's from
        content: {
            "label": "value"
        }

        // Special prop that defines a placeholder text shown on a row instead
        // of it's content, which disapears/fades out when a condition is met
        "placeholder": {
            "value": "string",
            "condition": "string"
        },
    }
    "edit": {
        // Format for the user input
        "formatting": {
            // What is the data being formatted
            "data": "string",

            // This has an automatic "input" variable passed to it which represents the prop
            "format": "string"
        }

        // Where the input data get sent for storage
        "destination": "string"   
    }

}
```

### Container rows
```
{
    "type": "ColumnContainer",
    "view": {
        "content": {
            "title": "string",
            "children": "ROW[]"
        }
    }
}
```

### Display Rows
```
{
    "type": "Carousel",
    "view": {
        "content": {
            "children": "ROW[]",
            "children_data": "string"
        }
    }
}
```
```
{
    "type": "Image",
    "view": {
        "content": {
            "image_id": "string"
        }
    }
}
```
```
{
    "type": "Title",
    "view": {
        "content": {
            "title": "string",
            "title_detail": "string",
            "subtitle_1": "string",
            "subtitle_2": "string"
        }
    }
}
```
```
{
    "type": "TimeslotPicker",
    "view": {
        "content": {
            "icon": "string",
            "subtitle": "string",
            "details": "string",
            "dates_with_timeslots": [{
                "header": "string",
                "date": "string",
                "timeslots": [{
                    "timeslot": "string",
                    "available": "boolean"
                }]
            }]
        }
    }
}
```
```
{
    "type": "Calendar",
    "view": {
        "content": {
            "transfer_options": "transfer_options"
        }
    }
}
```
```
{
    "type": "Text",
    "view": {
        "content": {
            "title": "string",
            "content": "string",
            "maxLines": "number"
        }
    }
}
```
```
{
    "type": "Detail",
    "view": {
        "content": {
            "title": "string",
            "icon": "string",
            "subtitle": "string",
            "detail": "string"
        }
    }
}
```
```
{
    "type": "Disclaimer",
    "view": {
        "content": {
            "icon": "string",
            "title": "string",
            "subtitle": "string"
        }
    }
}
```
```
{
    "type": "Address",
    "view": {
        "content": {
            "title": "string",
            "line_1": "string",
            "line_2": "string",
            "location": "location"
        }
    }
}
```
```
{
    "type": "PaymentOptions",
    "view": {
        "content": {
            "title": "string",
            "options": [{
                "icon": "string",
                "label": "string"
            }],
        }
    }
}
```
```
{
    "type": "SegmentedControl",
    "view": {
        "content": {
            "children": [{
                "title": "string",
                "children": "ROW[]"
            }],
        }
    }
}
```
```
{
    "type": "ContainerList",
    "view": {
        "content": {
            "children": "ROW[]"
        }
    }
}
```

### Editable rows
```
{
    "type": "Info",
    "view": {
        "content": {
            "title": "string"
        }
    }
}
```
```
{
    "type": "Input",
    "view": {
        "content": {
            "title": "string",
            "value": "string",
            "placeholder": "string"
        }
    }
}
```
```
{
    "type": "Search",
    "view": {
        "content": {
            "title": "string",
            "value": "string",
            "placeholder": "string",
            "data": "string"
        }
    }
}
```
```
{
    "type": "SearchMulti",
    "view": {
        "content": {
            "title": "string",
            "values": "string[]",
            "placeholder": "string",
            "data": "string"
        }
    }
}
```
```
{
    "type": "ActionRow",
    "view": {
        "content": {
            "title": "string",
            "value": "string",
            "action_title": "string"
        }
    }
}
```
```
{
    "type": "PhotoUpload",
    "view": {
        "content": {
            "icon": "string",
            "subtitle": "string",
            "content": "string",
            "photos": "photo[]"
        }
    }
}
```
```
{
    "type": "Select",
    "view": {
        "content": {
            "placeholder": "string",
            "value": "string",
            "options": "[]"
        }
    }
}
```
```
{
    "type": "Wheel",
    "view": {
        "content": {
            "value": "string",
            "options": "[]"
        }
    }
}
```