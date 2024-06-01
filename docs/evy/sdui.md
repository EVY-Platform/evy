# SDUI

## Flow

Flows are not visually used in the UI but represent a full user journey (eg: creating an item)  
They are needed in order to submit all fields of all pages of a flow at the end upon clicking a single button on a page

```
{
    "name",

    // Which service the flow belongs to, eg "marketplace"
    // This is not used on the client apps, only server-side
    "service",

    // The type of flow that it is: Create, Read, Update, Delete
    "type",

    // What is the data that the page is acting on, eg "item"
    "data": "model_name"
}
```

## Page

Pages are put into flows

```
{
    // Shown in the navbar
    "title",

    "rows": [ROW]
}
```

## Row

Rows are what are put into pages. They are the building block of the EVY SDUI framework

### Base features

-   All values are strings, there are no types as this is dynamic on the apps
    -   eg: "title": "My title", could also be "title": "{item.title}"
-   All strings can include:
    -   **variables** surrounded with curley braces: "Hello {name}, how are you?"
    -   **icons** surrounded with double colons: "EVY ::evy_icon:: is the best!"
    -   **emojis** prefixed with a colon: "I like :dog a lot"
-   [ x ]
    -   Denotes a type array of x
-   Nested rows (rows within rows)
    -   "ROW" denotes the type of a row, meaning that that prop expects more rows
-   Objects and arrays
    -   When objects or arrays are passed into a prop of content, they are parsed fully by the SDUI framework. Eg: "{item.tags}" will become "[{id": a, "value": "Furniture"}, {id": a, "value": "Chair"}]"

### Base schema that all rows inherit from:

```
{
    // The type of row that it is, see below
    "type",

    "view": {
        // Prop that defines when the row is visible
        // for example {count(item.transfer_option.pickup.dates_with_timeslots) > 0}
        "visible",

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
        "destination"
    },

    // What action should be taken when tapping the button
    "action": {
        "target": "navigate:flow_id:page_id|submit|close",
        "condition", // Optional condition that must be met to make the button enabled

    }
    }

}
```

### Base schema that container rows inherit from:

```
{
    "type",
    "view": {
        "content": {
            "children": [ROW],

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
    "type": "CarouselContainer", // Shows children in a carousel
}
```

```
{
    "type": "SelectContainer", // Shows children under a segmented control
    "view": {
        "content": {
            "children": [{
                "title", // What is the name of the selection
                "child": "ROW"
            }]
        }
    }
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
    "type": "TextArea",
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
            "photos"
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
                "end_timestamp",
                "available"
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

```
{
    "type": "DropdownRow",
    "view": {
        "content": {
            "value",
            "placeholder"
        },
        "data"
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
