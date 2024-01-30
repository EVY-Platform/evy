# Functions in EVY

Functions are used to convert an input into a different output. For example formatting a date.  
* Some default functions are available server-side and client-side (eg `formatDecimal`) and some are composed using those built in functions, and sent via JSON config to the clients.  
* We need to avoid defining custom coded formatting functions in mobile clients as much as possible due to the constraints of mobile release cycles

## Methods
These are methods available to the user to compute data
**count**
```
count({_variable_type_list_})
Variable: [image1, image2]
Output: 2
```

## Formatting funtions
These are functions that do 3 things:
1. Decide on which mobile keyboard to show
2. Format text from data
3. Format text as the user is typing  
Some of them are dynamic and some are built in (see following section)

#### All formatting available today
**formatCurrency**
```
formatCurrency(_variable_type_price_)
Variable: { "currency": "AUD", "value": "13.23" }
Outputs: $13.23
```
**formatDate**
```
formatDate(_variable_type_timestamp_, "MM/DD/YYYY")
Variable: 1705651372
Outputs: 19/01/2024
```
**formatDuration**
```
formatDuration(_variable_type_number_)
Variable: 900000
Outputs: 15 minutes
```
**formatDimension**
```
formatDimension(_variable_type_mm_) --> Depending on user config for metric or imperial
Variable: 2309
Outputs: 23.09cm
```
**formatAddress**
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
**formatAddressLine1**
```
formatAddressLine1(_variable_type_address_)
Variable: { ... see above ...}
Outputs: 23-25 Rosebery Avenue
```
**formatAddressLine2**
```
formatAddressLine2(_variable_type_address_)
Variable: { ... see above ...}
Outputs: 2018 Rosebery NSW
```

#### Built in configs
These are the formatting functions that are built directly into clients and the server
```
formatDate
formatDuration
formatDecimal
formatMetricLength
formatImperialLength
```

#### Dynamic configs
These are formats that are configured by passing dynamic JSON
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
        "input_type": "int",
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
