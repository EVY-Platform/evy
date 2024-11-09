# Data models

### Base model that all others inherit from:

```
id: uuid
created_timestamp: timestamp
updated_timestamp: timestamp
archived_timestamp: timestamp
```

### device

```
os: os
token: string
```

### organisation

```
name: string
description: string
logo_id: uuid
url: string
support_email: string
```

### service

```
name: string
description: string
```

### service_provider

```
service_id: uuid
organisation_id: uuid
name: string
description: string
logo_id: uuid
url: string
```

### location

```
latitude: decimal
longitude: decimal
```

#### price

```
currency: string
value: decimal
```

#### address

```
unit: string
street: string
city: string
postcode: string
state: string
country: string
location: location
instructions: string
```

#### tag

```
value: string
```

### photo

Base model with no extra props

### logo

Base model with no extra props

### payment_method

```
name: payment_method
```

### timeslot

```
start_timestamp: string
end_timestamp: string
available: boolean
type: string
```

### transfer_provider

```
name: string
logo_id: uuid
```

### transfer_options

```
pickup: {
    timeslots: [timeslot]
}
delivery: {
    fee: price
    timeslots: [timeslot]
}
ship: {
    cost: price
    transfer_provider_id: uuid
}
```
