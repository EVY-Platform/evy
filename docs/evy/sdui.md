# SDUI

## Flow
Flows are not visually used in the UI but represent a full user journey (eg: creating an item)
They are needed in order to submit all fields of all pages of a flow at the end upon clicking a single button on a page
```
{
    "name"
}
```

## Page
Pages are put into flows
```
{
    // Shown in the navbar
    "title",
    
    "flow_id",

    // Action button on the right on the navbar
    "action": "edit | delete | close | info",
    "tooltip": "This is used by the info action as popup data",
}
```

## Row
Rows are what are put into pages. They are the building block of the EVY SDUI framework  

### Base features
* All values are strings, there are no types as this is dynamic on the apps
    * eg: "title": "My title", could also be "title": "{item.title}"
* All strings can include:
    * **variables** surrounded with curley braces: "Hello {name}, how are you?"
    * **icons** surrounded with double colons: "EVY ::evy_icon:: is the best!"
    * **emojis** prefixed with a colon: "I like :dog a lot"
* [x]
    * Denotes a type array of x
* Content inside of row.view (see below)
    * Empty strings will be displayed and will NOT be ignored, but will essentially not be visible to the user
    * Missing keys will not be allowed, all keys/properties of a row content are required
* Nested rows, rows within rows
    * "ROW" denotes the type of a row, meaning that that prop expects more rows
* Objects and arrays
    * When objects or arrays are passed into a prop of content, they are parsed fully by the SDUI framework. Eg: "{item.tags}" will become "[{id": a, "value": "Furniture"}, {id": a, "value": "Chair"}]"
    * If transformations need to be done on the data, the **map** or **transform** functions needs to be used

### Base schema that all rows inherit from:
```
{
    // The type of row that it is, see below
    "type",

    // Prop that defines when the row is visible
    // for example {count(item.transfer_option.pickup.dates_with_timeslots) > 0}
    "visible",

    "view": {
        content: {
            // Represents the header of the row, if empty string then no header will be shown
            "title",

            // Each subsequent key/value pair represents a line of content shown on a row
            // the key is the name, the value is what the content is or where it's from
            //eg "subtitle": "My great subtitle"
        },

        // Special prop that defines a placeholder text shown on a row instead
        // of it's content, which disapears/fades out when a condition is met
        "placeholder": {
            "value",
            "condition"
        },
    },
    "edit": {
        // Where the input data is stored
        "destination",

        // Required for form validation for submissions
        "required"
    },

    "action": {
        // 2 types of actions that can be taken by a button
        // 1. Navigate: Goes to the specified page (and anchor if specified, used to scroll or navigate to specific sections of a page)
        // 2. Submit: Calls the API to submit the specified data
        "type": "navigate | submit",
        "target": "{page_id:anchor_id | data}"
    }

}
```

### Base schema that container rows inherit from:
```
{
    "type",
    "view": {
        "content": {
            "children": [{
                // Whether to show a title to the row, column, etc...
                "title",
                "child": "ROW"
            }],

            // Whether to use data to iterate over for example seller.pictures
            // This makes the "input" variable available to each child,
            //   which is the current child in the iteration
            "children_data"
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
    "type": "ListContainer", // Shows children in a list
}
```
```
{
    "type": "SelectContainer", // Shows children under a segmented control
}
```
```
{
    "type": "CarouselContainer", // Shows children in a carousel
}
```
```
{
    "type": "SheetContainer", // Shows a sheet with children when the row is tapped
    "view": {
        "content": {
            // What row to show for the action
            "child": "ROW"
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
            "photo_id"
        }
    }
}
```
```
{
    "type": "Title",
    "view": {
        "content": {
            "title_detail",
            "line_1",
            "line_2"
        }
    }
}
```
```
{
    "type": "TitleShort",
    "view": {
        "content": {
            "icon",
            "detail",
            "disclaimer"
        }
    }
}
```
```
{
    "type": "Text",
    "view": {
        "content": {
            "text"
        },
        "max_lines"
    }
}
```
```
{
    "type": "Detail",
    "view": {
        "content": {
            "icon",
            "line_1",
            "line_2",
            "detail"
        }
    }
}
```
```
{
    "type": "Disclaimer",
    "view": {
        "content": {
            "icon",
            "disclaimer"
        }
    }
}
```
```
{
    "type": "Address",
    "view": {
        "content": {
            "line_1",
            "line_2",
            "location": {
                "latitude"
                "longitude"
            }
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
            "value",
            "placeholder"
        }
    },
    "edit": {
        "minimum_characters",
        "minimum_number"
    }
}
```
```
{
    "type": "Search",
    "view": {
        "content": {
            "value",
            "placeholder"
        },
        "multi",
        "data"
    },
    "edit": {
		"minimum_number"
    }
}
```
```
{
    "type": "Select",
    "view": {
        "content": {
            "header",
            "value"
        },
        "multi",
        "data"
    }
}
```
```
{
    "type": "Wheel",
    "view": {
        "content": {
            "value"
        },
        "multi",
        "data"
    }
}
```
```
{
    "type": "SelectPhoto",
    "view": {
        "content": {
            "icon",
            "subtitle",
            "content",
            "photo_ids"
        },
        "data"
    },
    "edit": {
        "minimum_number"
    }
}
```
```
{
    "type": "TimeslotPicker",
    "view": {
        "content": {
            "icon",
            "subtitle",
            "detail",
            "timeslots":[{
                "id",
                "start_timestamp",
                "end_timestamp"
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
            "layers": [{
                "primary",
                "visible",
                "timeslots":[{
                    "id",
                    "start_timestamp",
                    "end_timestamp"
                }]
            }]
        }
    },
    "edit": {
		"minimum_number"
    }
}
```

### Button rows
```
{
    "type": "Button",
    "view": {
        "content": {
            "label"
        }
    }
}
```