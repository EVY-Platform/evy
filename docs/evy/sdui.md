# SDUI

## Data

Whenever flows are sent to a client app, any static data that is necessary is also passed. For example, the values of "10 min, 20 min, 30 min" for the distance that someone is willing to travel to to deliver an item is passed in along with the flows for items, along with a UUID which identifies that data within the UI data.

```
{
    _flow1_
        _pages_
            _rows_
    _flow2_
        _pages_
            _rows_
    ...
    _data_: {
        "254190d9-0a99-43d0-a3c2-f222bdec1893": [{
            "id": "68e52916-7a07-4a07-ae0c-52e7800b9b9f",
            "value": "5 min",
        },{
            "id": "8e1cd2bf-d94f-4bb0-bd68-fc74434deabe",
            "value": "10 min",
        },{
            "id": "1eedac33-eb0b-4796-9853-50ad4036179f",
            "value": "15 min",
        },{
            "id": "69f25102-822c-436c-a6c1-3b49f887355e",
            "value": "30 min",
        }]
    }
}
```

## Flow

Flows are not visually used in the UI but represent a full user journey (eg: creating an item)  
They are needed in order to submit all fields of all pages of a flow at the end upon clicking a single button on a page

```
{
    "id",
    "name",

    // Which service the flow belongs to, eg "marketplace"
    // This is not used on the client apps, only server-side
    "service",

    // The type of flow that it is: Create, Read, Update, Delete
    "type",

    // What is the data that the page is acting on, eg "item"
    "data": "model_name"

    "pages": [PAGE]
}
```

## Page

Pages are put into flows

```
{
    // Shown in the navbar
    "title",

    // The rows that are on the page
    "rows": [ROW],

    // Shown as sticky footer
    "footer": ROW
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
        content: {
            // Represents the header of the row, if empty string then no header will be shown
            "title",

            // Each subsequent key/value pair represents a line of content shown on a row
            // the key is the name, the value is what the content is or where it's from
            //eg "subtitle": "My great subtitle"
        },
    },
    "edit": {
        // Where the input data is stored
        "destination",

        // Whether this row is required for a page to be considered complete
        "required"

    },

    // What action should be taken when tapping the button
    "action": {
        "target": "navigate:flow_id:page_id|submit|close",
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
                "title", // What is the name, title or header of the child
                "child": "ROW"
            }],

            // Number of children required to be complete to
            // consider the container complete
            "required_children",

            // Whether to use data to iterate over for example seller.pictures
            // This makes the "input" variable available to each child,
            //   which is the current child in the iteration
            "children_data"
        }
    }
}
```

### Rows

### Container Rows

#### ColumnContainer

Shows children in columns

-   type: "ColumnContainer"

#### ListContainer

Shows children in a list

-   type: "ListContainer"

#### SelectSegmentContainer

Shows children under a segmented control

-   type: "SelectSegmentContainer"

#### SheetContainer

Shows a sheet with children when tapped (does not implement edit behavior)

-   type: "SheetContainer"
-   view.content.child: Child row to show

### Display Rows

#### Calendar

Displays a calendar view

-   type: "Calendar"
-   view.content.primary: Array of primary calendar items
-   view.content.secondary: Array of secondary calendar items
-   Calendar items contain:
    -   x: X position
    -   y: Y position
    -   header: Header text
    -   start_label: Start time label
    -   end_label: End time label
    -   selected: Whether item is selected

#### Dropdown

Displays a dropdown selector

-   type: "Dropdown"
-   view.content.format: Format of dropdown
-   view.content.placeholder: Placeholder text
-   view.data: Data for dropdown options
-   edit.destination: Where selection is stored
-   edit.required: Whether selection is required

#### InlinePicker

Inline selection picker

-   type: "InlinePicker"
-   view.content.options: Array of selectable options
-   view.content.placeholder: Placeholder text
-   edit.destination: Where selection is stored
-   edit.required: Whether selection is required

#### Input

Single-line text input field

-   type: "Input"
-   view.content.placeholder: Placeholder text
-   view.content.keyboard_type: Type of keyboard to show (text, number, email, etc)
-   edit.destination: Where input is stored
-   edit.required: Whether input is required

#### Search

Displays a search input field

-   type: "Search"
-   view.content.placeholder: Placeholder text
-   view.content.scope: Search scope/context
-   edit.destination: Where search query is stored
-   action.target: Action to perform on search submit

#### SelectPhoto

Displays a photo selector

-   type: "SelectPhoto"
-   view.content.placeholder: Placeholder text/image
-   view.content.max_photos: Maximum number of photos allowed
-   edit.destination: Where selected photo IDs are stored
-   edit.required: Whether photo selection is required

#### TextArea

Multi-line text input

-   type: "TextArea"
-   view.content.placeholder: Placeholder text
-   edit.destination: Where input is stored
-   edit.required: Whether input is required

#### TextSelect

Displays selectable text options

-   type: "TextSelect"
-   view.content.options: Array of text options
-   view.content.multi_select: Whether multiple selections are allowed
-   edit.destination: Where selection(s) are stored
-   edit.required: Whether selection is required

### Display Rows

#### Info

Displays informational text

-   type: "Info"
-   view.content.text: Info text to display
-   view.content.style: Text style formatting

#### InputList

List of text input fields

-   type: "InputList"
-   view.content.inputs: Array of input configurations
-   view.content.placeholder: Default placeholder text
-   edit.destination: Where inputs are stored
-   edit.required: Whether inputs are required

#### TextAction

Displays text with an associated action

-   type: "TextAction"
-   view.content.text: Text to display
-   view.content.style: Text style formatting
-   action.target: Action to perform when text is tapped

#### Text

Displays text content

-   type: "Text"
-   view.content.text: Text to display
-   view.content.style: Text style formatting

### Action Rows

#### Button

Displays a button

-   type: "Button"
-   view.content.label: Button label text
-   edit: Button edit options
-   action.target: Button tap action (navigate/submit/close)
