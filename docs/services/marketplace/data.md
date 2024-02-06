# Data models

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
