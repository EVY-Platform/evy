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
* Nested rows, rows within rows
    * "ROW" denotes the type of a row, meaning that that prop expects more rows

### Base schema that all rows inherit from:
```
{
    // The type of row that it is, see below
    type: "string",

    // Prop that defines when the row is visible
    // for example {count(item.transfer_option.pickup.dates_with_timeslots) > 0}
    "visible": "string"

    "view": {
        // Each key/value pair represents a line of content shown on a row
        // the key is the name, the value is what the content is or where it's from
        content: {
            "label": "value"
        },

        // Special prop that defines a placeholder text shown on a row instead
        // of it's content, which disapears/fades out when a condition is met
        "placeholder": {
            "value": "string",
            "condition": "string"
        },
    }
    "edit": {
        // Where the input data is stored
        "destination": "string"   
    }

}
```

### Base schema that container rows inherit from:
```
{
    "type": "string",
    "view": {
        "content": {
            "title": "string",
            "children": [{
                // Whether to show a title to the row, column, etc...
                "title": "string",
                "child": "ROW"
            }],

            // Whether to use data to iterate over for example seller.pictures[]
            // This makes the "input" variable available to each child,
            //   which is the current child in the iteration
            "children_data": "string"
        }
    }
}
```

### Container rows
```
{
    "type": "ColumnContainer", // Shows children in columns
}
```
```
{
    "type": "ContainerList", // Shows children in a list
}
```
```
{
    "type": "SegmentedControl", // Shows children under a segmented control
}
```
```
{
    "type": "Carousel", // Shows children in a carousel
}
```
```
{
    "type": "SheetRow", // Shows a sheet with children when the row is tapped
    "view": {
        "content": {
            // These props will show on the row itself
            "title": "string",
            "value": "string",
            "action_title": "string",

            // These props will show on the sheet
            "children_header": "string"
        }
    }
}
```

### Display Rows
```
{
    "type": "Image",
    "view": {
        "content": {
            "photo": "photo"
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
    "type": "TitleShort",
    "view": {
        "content": {
            "icon": "string",
            "title": "string",
            "disclaimer": "string"
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
            "timeslots": "[timeslot]"
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

### Editable rows
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
    "type": "PhotoUpload",
    "view": {
        "content": {
            "icon": "string",
            "subtitle": "string",
            "content": "string",
            "photos": "[photo]"
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