# frodo
One platform to rule them all - Feature as a service platform

## Setup
1. Setup NodeJS
2. Setup Docker
You're good to go.

## Tools and commands
#### Devops
- To build & run frodo api with pgsql: `docker compose -f docker-compose.dev.yml up --build`
- To build & run frodo api separately with docker compose just comment out the pgsql service in docker-compose.dev.yml
- To build & run frodo api manually with watch: `yarn dev`