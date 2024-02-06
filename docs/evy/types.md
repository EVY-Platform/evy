# Data types

### Strings for SDUI
All strings can include:
-   **variables** surrounded with curley braces: "Hello {name}, how are you?"
-   **icons** surrounded with double colons: "EVY ::evy_icon:: is the best!"
-   **emojis** prefixed with a colon: "I like :dog a lot"

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