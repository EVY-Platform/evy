#!/bin/bash
set -eu

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_IOS=false
for arg in "$@"; do
    case $arg in
        --skip-ios) SKIP_IOS=true ;;
    esac
done

API_RESULT=0
WEB_RESULT=0
IOS_RESULT=0
IOS_SKIPPED=false

MAX_RETRIES=60
RETRY_INTERVAL_SECONDS=1
COMPOSE_DB_DOMAIN="postgres"
API_WS_READINESS_JS='import { Client } from "rpc-websockets"; const port = process.env.API_PORT; if (!port) process.exit(1); const client = new Client(`ws://localhost:${port}`); const timeout = setTimeout(() => { client.close(); process.exit(1); }, 1000); client.on("open", async () => { try { await client.call("get", { namespace: "evy", resource: "SDUI" }); clearTimeout(timeout); client.close(); process.exit(0); } catch { clearTimeout(timeout); client.close(); process.exit(1); } }); client.on("error", () => { clearTimeout(timeout); client.close(); process.exit(1); });'

set -a
source .env
set +a

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}EVY End-to-End Test Runner${NC}"
echo -e "${YELLOW}========================================${NC}"

cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    DB_DOMAIN="$COMPOSE_DB_DOMAIN" docker compose --env-file .env down -v --remove-orphans 2>/dev/null || true
}

trap cleanup EXIT

echo -e "\n${YELLOW}Step 1: Starting services with docker compose...${NC}"
DB_DOMAIN="$COMPOSE_DB_DOMAIN" docker compose --env-file .env build --no-cache web
DB_DOMAIN="$COMPOSE_DB_DOMAIN" docker compose --env-file .env up --build -d

echo -e "\n${YELLOW}Step 2: Waiting for services to be healthy...${NC}"

echo "Waiting for PostgreSQL..."
PG_RETRY_COUNT=0
until docker compose exec -T postgres pg_isready -U evy > /dev/null 2>&1 || [ $PG_RETRY_COUNT -eq $MAX_RETRIES ]; do
    sleep 1
    PG_RETRY_COUNT=$((PG_RETRY_COUNT + 1))
done
if [ $PG_RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${YELLOW}PostgreSQL health check timed out, but continuing...${NC}"
else
    echo -e "${GREEN}PostgreSQL is ready${NC}"
fi

echo "Waiting for API..."
RETRY_COUNT=0
until DB_DOMAIN="$COMPOSE_DB_DOMAIN" docker compose --env-file .env exec -T api bun -e "$API_WS_READINESS_JS" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    sleep "$RETRY_INTERVAL_SECONDS"
    RETRY_COUNT=$((RETRY_COUNT + 1))
done
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${YELLOW}API health check timed out, but continuing...${NC}"
else
    echo -e "${GREEN}API is ready${NC}"
fi

echo "Waiting for Web..."
RETRY_COUNT=0
until curl -s http://localhost:3000 > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    sleep 1
    RETRY_COUNT=$((RETRY_COUNT + 1))
done
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${YELLOW}Web health check timed out, but continuing...${NC}"
else
    echo -e "${GREEN}Web is ready${NC}"
fi

echo -e "\n${YELLOW}Step 3: Seeding database...${NC}"
bun install
if ! bun db:seed; then
    echo -e "${RED}Database seeding failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 4: Running API e2e tests...${NC}"
cd api
bun install
if bun test e2e/; then
    echo -e "${GREEN}API e2e tests passed${NC}"
else
    echo -e "${RED}API e2e tests failed${NC}"
    API_RESULT=1
fi
cd ..

echo -e "\n${YELLOW}Step 5: Running Web e2e tests...${NC}"
cd web
bun install
if bunx playwright test --config=playwright.e2e.config.js; then
    echo -e "${GREEN}Web e2e tests passed${NC}"
else
    echo -e "${RED}Web e2e tests failed${NC}"
    WEB_RESULT=1
fi
cd ..

if [ "$SKIP_IOS" = true ]; then
    echo -e "\n${YELLOW}Step 6: Skipping iOS e2e tests (--skip-ios flag set)${NC}"
    IOS_SKIPPED=true
else
    echo -e "\n${YELLOW}Step 6: Running iOS e2e tests...${NC}"
    if ! bun db:seed; then
        echo -e "${RED}Database seeding failed${NC}"
        exit 1
    fi
    cd ios
    if API_HOST=localhost:$API_PORT xcodebuild test \
        -project evy.xcodeproj \
        -scheme evy \
        -destination 'platform=iOS Simulator,name=iPhone Air,OS=26.2' \
        -quiet; then
        echo -e "${GREEN}iOS e2e tests passed${NC}"
    else
        echo -e "${RED}iOS e2e tests failed${NC}"
        IOS_RESULT=1
    fi
    cd ..
fi

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}Test Results Summary${NC}"
echo -e "${YELLOW}========================================${NC}"

if [ $API_RESULT -eq 0 ]; then
    echo -e "API:  ${GREEN}PASSED${NC}"
else
    echo -e "API:  ${RED}FAILED${NC}"
fi

if [ $WEB_RESULT -eq 0 ]; then
    echo -e "Web:  ${GREEN}PASSED${NC}"
else
    echo -e "Web:  ${RED}FAILED${NC}"
fi

if [ "$IOS_SKIPPED" = true ]; then
    echo -e "iOS:  ${YELLOW}SKIPPED${NC}"
elif [ $IOS_RESULT -eq 0 ]; then
    echo -e "iOS:  ${GREEN}PASSED${NC}"
else
    echo -e "iOS:  ${RED}FAILED${NC}"
fi

if [ $API_RESULT -ne 0 ] || [ $WEB_RESULT -ne 0 ] || ([ "$IOS_SKIPPED" = false ] && [ $IOS_RESULT -ne 0 ]); then
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
fi
