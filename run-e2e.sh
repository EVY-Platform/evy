#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_RESULT=0
WEB_RESULT=0
IOS_RESULT=0

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}EVY End-to-End Test Runner${NC}"
echo -e "${YELLOW}========================================${NC}"

cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    docker-compose down -v --remove-orphans 2>/dev/null || true
}

trap cleanup EXIT

echo -e "\n${YELLOW}Step 1: Starting services with docker-compose...${NC}"
docker-compose up --build -d

echo -e "\n${YELLOW}Step 2: Waiting for services to be healthy...${NC}"

echo "Waiting for PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U evy > /dev/null 2>&1; do
    sleep 1
done
echo -e "${GREEN}PostgreSQL is ready${NC}"

echo "Waiting for API..."
MAX_RETRIES=30
RETRY_COUNT=0
until curl -s http://localhost:8000 > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    sleep 1
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

echo -e "\n${YELLOW}Step 3: Running API e2e tests...${NC}"
cd api
if bun test e2e/; then
    echo -e "${GREEN}API e2e tests passed${NC}"
else
    echo -e "${RED}API e2e tests failed${NC}"
    API_RESULT=1
fi
cd ..

echo -e "\n${YELLOW}Step 4: Running Web e2e tests...${NC}"
cd web
if bunx playwright test --config=playwright.e2e.config.js; then
    echo -e "${GREEN}Web e2e tests passed${NC}"
else
    echo -e "${RED}Web e2e tests failed${NC}"
    WEB_RESULT=1
fi
cd ..

echo -e "\n${YELLOW}Step 5: Running iOS e2e tests...${NC}"
cd ios
if xcodebuild test \
    -project evy.xcodeproj \
    -scheme evy \
    -destination 'platform=iOS Simulator,name=iPhone Air,OS=26.2' \
    API_HOST=localhost:8000 \
    -quiet; then
    echo -e "${GREEN}iOS e2e tests passed${NC}"
else
    echo -e "${RED}iOS e2e tests failed${NC}"
    IOS_RESULT=1
fi
cd ..

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

if [ $IOS_RESULT -eq 0 ]; then
    echo -e "iOS:  ${GREEN}PASSED${NC}"
else
    echo -e "iOS:  ${RED}FAILED${NC}"
fi

if [ $API_RESULT -ne 0 ] || [ $WEB_RESULT -ne 0 ] || [ $IOS_RESULT -ne 0 ]; then
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
fi
