# frodo
One platform to rule them all - Feature as a service platform

## Setup
1. Setup NodeJS
2. Setup Docker
You're good to go.

## Tools and commands
#### Devops
- `docker compose up --build` to build frodo in release mode along with a surrealDB instance  
- If you want to run them separately:  
```
docker run --rm -p 8000:8000 -v surrealdb:/database.db surrealdb/surrealdb:latest start --log trace --user root --pass root file:database.db

docker build -t frodo .
docker run -p 8080:8080 --rm --name frodo -e FRODO_SURREALDB_HOST="host.docker.internal" frodo
```
- `yarn watch` to dev frodo manually