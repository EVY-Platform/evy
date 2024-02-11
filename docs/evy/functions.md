# Functions in EVY

Functions are used to convert an input into a different output. For example formatting a date.  
* Some default functions are available server-side and client-side (eg `formatDecimal`) and some are composed using those built in functions, and sent via JSON config to the clients.  
* We need to avoid defining custom coded formatting functions in mobile clients as much as possible due to the constraints of mobile release cycles

## Methods
These are methods available to the user to compute data
#### count
```
count({_variable_type_list_})
Variable: [image1, image2]
Output: 2
```
#### map
In order to transform data from arrays, EVY has a simple function which iterates over a list and allows applying transformations, as well as use the index. Note that single quotes are used for strings inside functions, and that additional strings need to have their single quotes escaped.
```
timeslots = [
    {"id": "x", "start_timestamp": "987491276381"},
    {"id": "y", "start_timestamp": "987491276381"},
    {"id": "z", "start_timestamp": "987491276381"}
]
```
```
map(timeslots)({'timeslot': '{formatDate(input.start_timestamp, \'HH:mm\')}'})
Ouput: [
    {"timeslot": "10:30"},
    {"timeslot": "11:00"},
    {"timeslot": "13:30"}
]
```
Also made available is the index of
```
map(timeslots)({'{index}': '{input.id}'})
Ouput: [
    {"1": "x"},
    {"2": "y"},
    {"3": "z"}
]
```
#### transform
In order to transform data from objects, EVY has a simple function which allows adding keys or replacing any value. Note that single quotes are used for strings inside functions, and that additional strings need to have their single quotes escaped.
```
address = {
    "unit": "23-25",
    "street": "Rosebery Avenue",
    "city": "Rosebery",
    "postcode": "2018",
    "state": "NSW",
    "country": "Australia",
    "location": {
        "latitude": 45.323124,
        "longitude": -3.424233
    }
}
```
Adding
```
transform(address)({'street_and_unit': '{address.unit} {address.street}'})
Ouput: {
    "unit": "23-25",
    "street": "Rosebery Avenue",
    "city": "Rosebery",
    "postcode": "2018",
    "state": "NSW",
    "country": "Australia",
    "location": {
        "latitude": 45.323124,
        "longitude": -3.424233
    },
    "street_and_unit": "23-25 Rosebery Avenue"
}
```
Replacing
```
transform(address)({'street': '{address.unit} {address.street}'})
Ouput: {
    "unit": "23-25",
    "street": "23-25 Rosebery Avenue",
    "city": "Rosebery",
    "postcode": "2018",
    "state": "NSW",
    "country": "Australia",
    "location": {
        "latitude": 45.323124,
        "longitude": -3.424233
    }
}
```
#### group
```
timeslots = [
    {"id": "x", "start_timestamp": "987491276381"},
    {"id": "y", "start_timestamp": "987491276381"},
    {"id": "z", "start_timestamp": "987491276381"}
]
```
```
group(timeslots)({formatDate(input.start_timestamp, \'DD/MM/YYYY\')})
Ouput: {
    '01/01/2024': [
        {"id": "x", "start_timestamp": "987491276381"},
        {"id": "y", "start_timestamp": "987491276381"}
    ],
    '01/02/2024': [
        {"id": "z", "start_timestamp": "987491276381"}
    ]
}
```

## Formatting functions
These are functions that do 3 things:
1. Decide on which mobile keyboard to show
2. Format text from data
3. Format text as the user is typing  

Some of them are dynamic and some are built in (see following section)

### Formatting functions built in
Meaning they are hard coded into the server and clients  

#### formatDecimal
```
formatDecimal(_variable_type_number_, 2)
Variable: 20.0423
Outputs: 20.04
```
#### formatMetricLength
```
formatMetricLength(_variable_type_number_) // Takes milimeters
Variable: 23240
Outputs: 23.24m
```
#### formatImperialLength
```
formatImperialLength(_variable_type_number_) // Takes milimeters
Variable: 4231
Outputs: 13.88ft
```
#### formatDuration
```
formatDuration(_variable_type_number_)
Variable: 900000
Outputs: 15 minutes
```
#### formatDate
```
formatDate(_variable_type_timestamp_, "MM/DD/YYYY")
Variable: 1705651372
Outputs: 19/01/2024
```

### Dynamic formatting functions
These are formats that are configured by passing dynamic JSON, and using region or device configs  

#### formatCurrency
```
formatCurrency(_variable_type_price_)
Variable: { "currency": "AUD", "value": "13.23" }
Outputs: $13.23
```
#### formatAddress
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

#### Sample code:
```
{
    "formatCurrency": {
        "input_type": "price",
        "keyboard": "numeric_detailed",
        "formatting_config": "{input.currency}",
        "formatting": {
            "aud": "$ {formatDecimal(input.value, 2)}",
            "eur": "€ {formatDecimal(input.value, 2)}"
        }
    },
    "formatDimension": {
        "input_type": "number",
        "keyboard": "numeric_detailed",
        "formatting_config": "{user.dimensions_system}",
        "formatting": {
            "metric": "{formatMetricLength(input)}",
            "imperial": "{formatImperialLength(input)}"
        }
    },
    "formatAddress": {
        "input_type": "address",
        "keyboard": "text",
        "formatting_config": "{input.country}",
        "formatting": {
            "au": "{input.unit} {input.street}, {input.city} {input.postcode} {input.state}",
            "us": "{input.unit} {input.street}, {input.city} {input.state} {input.postcode}"
        }
    },
    "formatAddressLine1": {
        "input_type": "address",
        "keyboard": "text",
        "formatting_config": "{input.country}",
        "formatting": {
            "au": "{input.unit} {input.street}",
            "us": "{input.unit} {input.street}"
        }
    },
    "formatAddressLine2": {
        "input_type": "address",
        "keyboard": "text",
        "formatting_config": "{input.country}",
        "formatting": {
            "au": "{input.city} {input.postcode} {input.state}",
            "us": "{input.city} {input.state} {input.postcode}"
        }
    }
}