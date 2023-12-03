# Data motels

See [types](./types.md) for custom types and definitions used below  
Base model that all data models inherit from:

```
{
    "id": "uuid",
    "created_timestamp": "timestamp",
    "updated_timestamp": "timestamp"
}
```

## EVY

#### device

```
{
    "os": "os",
    "token": "string"
}
```

#### organisation

```
{
    "name": "string",
    "description": "string",
    "logo": "image",
    "url": "string",
    "support_email": "string"
}
```

#### service

```
{
    "name": "string",
    "description": "string"
}
```

#### service_provider

```
{
    "service_id": "service.id",
    "organisation_id": "organisation.id",
    "name": "string",
    "description": "string",
    "logo": "image",
    "url": "string",
}
```

## Marketplace

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
