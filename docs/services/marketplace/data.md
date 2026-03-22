# Marketplace data models

These shapes are **domain models** used by the marketplace service. They are not defined in the repo’s JSON Schema; they are stored as JSON under `NamespacedData.marketplace` and validated at the application layer. See [EVY data models](../evy/sddata/data.md) for the API persistence schema and the distinction between schema-defined types and domain models.

---

## location

```
latitude: decimal
longitude: decimal
```

## price

```
currency: string
value: decimal
```

## address

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

## area

```
id: uuid
value: string
```

## tag

```
value: string
```

## photo

Base model with no extra props.

## logo

Base model with no extra props.

## timeslot

Instants must be ISO 8601 strings. Preferred names:

```
startAt: string (date-time)
endAt: string (date-time)
available: boolean
type: string
```

Legacy field names `start_timestamp` / `end_timestamp` are still validated the same way if present: **ISO strings only**, not Unix seconds or milliseconds.

## transfer_options

```
pickup: {
    timeslots: [timeslot]
    address: address
}
delivery: {
    fee: price
    timeslots: [timeslot]
}
ship: {
    postal_code: string
    areas: [area]
}
```