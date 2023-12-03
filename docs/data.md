# Custom marketplace types

See [types](./types.md) for custom types and definitions used below

### Base model that all data models inherit from":

```
{
    "id": "uuid",
    "created_timestamp": "timestamp",
    "updated_timestamp": "timestamp"
}
```

#### timeslot

```
{
    "timeslot": "timestamp",
    "available": "boolean"
}
```

#### location

```
{
    "latitude": "float",
    "longitude": "float"
}
```

#### address

```
{
    "street": "string",
    "city": "string",
    "postcode": "string",
    "state": "string",
    "country": "string",
    "location": location
}
```

#### image

```
{
    // Just base model
}
```

#### price

```
{
    "currency": "string",
    "value": "float"
}
```

#### seller

```
{
    "reliability_rate": "number",
    "items_sold": "number"
}
```

#### transfer_provider

```
{
    "name": "string",
    "logo": "image",
    "eta": "string",
    "fee": "price"
}
```

#### transfer_option

```
{
    "pickup: {
        "timeslots": "timeslot[]"
    },
    "delivery": {
        fee": "price",
        "timeslots": "timeslot[]"
    },
    "ship": {
        "fee": "price",
        "transfer_provider": "transfer_provider"
    }
}
```

#### tag

```
{
    "value": "string"
}
```

#### item

```
{
    "title": "string",
    "photos": "image[]",
    "price": "price",
    "seller": "seller",
    "address": "address",
    "transfer_option": "transfer_option[]",
    "description": "string",
    "condition": "string",
    "selling_reason": "string",
    "dimension": {
        "width": "number",
        "height": "number",
        "length": "number",
    },
    "tags": "tag[]",
    "payment_methods": "payment_method[]"
}
```
