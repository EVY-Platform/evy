# Data models

#### seller
```
reliability_rate: float
items_sold: int
```

#### dimension
```
width: int
height: int
length: int
weight: int
```

#### condition
```
value: string
```

#### selling_reason
```
value: string
```

#### area
```
id: uuid
value: string
```

#### duration
```
id: uuid 
value: string
```

#### timeslot
```
x: int
y: int
header: string
start_label: string
end_label: string
selected: boolean
```

#### item
```
title: string
description: string
seller_id: uuid
condition_id: uuid
selling_reason_id: uuid
tag_ids: [uuid]
tags: [tag]
payment_methods: {
    cash: boolean
    app: boolean
}
photo_ids: [string]
address: address
price: price
dimension: dimension
transfer_options: {
    pickup: {
        timeslots: [timeslot]
        address: address
    }
    delivery: {
        timeslots: [timeslot]
        fee: price
    }
    shipping: {
        postal_code: string
        areas: [area]
    }
}
```
