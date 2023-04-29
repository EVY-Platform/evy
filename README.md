# frodo
One platform to rule them all - Feature as a service platform

## Setup
1. Setup Rust
2. Setup Docker
You're good to go.

## WIP
- Better crates caching with docker & docker-compose
- Healthcheck the api server
- Potentially set up docker for dev-ing (currently not practical due to 1. build tooling necessary within docker, 2. un-tree shaken code and dependencies is several gigs, 3. much worse perf for compiling within docker compared to local)

## Tools and commands
#### Devops
- `docker compose up --build` to build frodo in release mode along with a surrealDB instance  
- If you want to run them separately:  
```
docker run --rm -p 8000:8000 -v surrealdb:/database.db surrealdb/surrealdb:latest start --log trace --user root --pass root file:database.db

docker build -t frodo .
docker run -p 8080:8080 --rm --name frodo -e FRODO_SURREALDB_HOST="host.docker.internal" frodo
```
- `cargo watch -d 0 -x run` to dev frodo manually

#### SurrealQL
Useful commands for generating data or doing queries
```
REMOVE TABLE service;

DEFINE TABLE service SCHEMAFULL;

DEFINE FIELD created_timestamp ON service TYPE number
  VALUE $value OR time::unix()
  ASSERT $value != NONE;
DEFINE FIELD updated_timestamp ON service TYPE number
  VALUE time::unix()
  ASSERT $value != NONE;
DEFINE FIELD name ON TABLE service TYPE string
  ASSERT $value != NONE
  ASSERT is::ascii($value);
DEFINE FIELD description ON TABLE service TYPE string
  ASSERT $value != NONE
  ASSERT is::ascii($value);
DEFINE FIELD list_name ON TABLE service TYPE string
  ASSERT is::ascii($value);

CREATE service SET name = 'Ride booking', description = 'A fancy description of ride hailing services';

CREATE service SET name = 'Contruction supplies', description = 'Get supplies to your construction site on demand', list_name = 'Construction Supplies';

SELECT * FROM service;

UPDATE service:orc0k1kjgukg6za8loa2 SET description = "Book a ride directly from SAM";

SELECT * FROM service;
```

#### Rando
- RustFMT  
Install with `rustup component add rustfmt`  
On VSCode can be used with [Rust Analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) and the following config:
```
"[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer",
    "editor.formatOnSave": true
}
```
Notes: https://rust-lang.github.io/api-guidelines/naming.html