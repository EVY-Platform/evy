# frodo
One platform to rule them all - Feature as a service platform

## Setup
1. Setup NodeJS
2. Setup Docker
You're good to go.

## Tools and commands
#### Devops
- To build & run frodo api with SurrealDB: `docker compose up --build`
- To build & run them separately:
```
docker run --rm -p 8000:8000 -v surrealdb:/database.db surrealdb/surrealdb:latest start --log trace --user root --pass root file:database.db
docker build -t frodo . && docker run -p 8080:8080 --rm --name frodo frodo
```
- To build & run frodo api manually with watch: `yarn watch`