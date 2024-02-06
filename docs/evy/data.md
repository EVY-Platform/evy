# Data models

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

#### tag

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
