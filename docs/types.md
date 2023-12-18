# Type definitions

### Built in types used on EVY

```
uuid
string
enum
int
float
boolean
timestamp
[] // denotes an array variable, used as such: string[] or int[]
? // denotes an optional variable, used as such: string? or int?

// Custom shared enums
payment_method (card|cash|bank)
os (ios|android)
```

### Types have strict validation at the database level
- eg a uuid has to match the format for a UUID V4
- eg a timestamp has to be a valid unix timestamp