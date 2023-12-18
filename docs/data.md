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
    "service_id": "service.id",
    "organisation_id": "organisation.id",
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

#### item

```
{
    "title": "string",
    "photo_ids": "uuid[]",
    "price": "price",
    "seller_id": "uuid",
    "address": "address",
    "transfer_options": "transfer_option[]",
    "description": "string",
    "condition": "string",
    "selling_reason": "string",
    "dimension": "dimension",
    "tag_ids": "uuid[]",
    "payment_method_ids": "uuid[]"
}
```
