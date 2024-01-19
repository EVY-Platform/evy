# Data motels

See [types](./types.md) for custom types and definitions used below  
Base model that all data models inherit from:

```
{
    "id": "uuid",
    "created_timestamp": "timestamp",
    "updated_timestamp": "timestamp",
    "archived_timestamp": "timestamp"
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
    "logo_id": "uuid",
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
    "service_id": "uuid",
    "organisation_id": "uuid",
    "name": "string",
    "description": "string",
    "logo_id": "uuid",
    "url": "string",
}
```

## Marketplace

#### timeslot
```
{
    "timeslot": "string"
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
    "unit": "string",
    "street": "string",
    "city": "string",
    "postcode": "string",
    "state": "string",
    "country": "string",
    "location": location
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
    "reliability_rate": "float",
    "items_sold": "int"
}
```

#### transfer_provider

```
{
    "name": "string",
    "logo_id": "uuid",
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
        "cost": "price",
        "transfer_provider_id": "uuid"
    }
}
```

#### tag

```
{
    "value": "string"
}
```

#### dimension

```
{
    "width": "int",
    "height": "int",
    "length": "int",
}
```

#### condition

```
{
    "value": "string"
}
```

#### selling_reason

```
{
    "value": "string"
}
```

#### photo

```
{}
```

#### logo

```
{}
```

#### payment_method

```
{
    "name": "string"
}
```

#### item

```
{
    "title": "string",
    "description": "string",

    "seller_id": "uuid",
    "condition_id": "uuid",
    "selling_reason_id": "uuid",

    "tag_ids": "uuid[]",
    "payment_method_ids": "uuid[]",

    "photos": "photo[]",
    "address": "address",
    "price": "price",
    "dimension": "dimension",
    "transfer_option": "transfer_option"
}
```
