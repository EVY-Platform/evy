#!/bin/bash
set -eu

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Parse arguments
SKIP_IOS=false
NO_DOCKER=false
for arg in "$@"; do
    case $arg in
        --skip-ios) SKIP_IOS=true ;;
        --no-docker) NO_DOCKER=true ;;
    esac
done

API_RESULT=0
WEB_RESULT=0
IOS_RESULT=0
IOS_SKIPPED=false
MAX_RETRIES=30
RETRY_DELAY_SECONDS=2
API_PID=""
MARKETPLACE_PID=""
WEB_PID=""

# Preserve env overrides when sourcing `.env` (e.g. WEB_PORT=3001 ./run-e2e.sh).
_PRESET_WEB_PORT="${WEB_PORT-}"
_PRESET_API_PORT="${API_PORT-}"
_PRESET_MARKETPLACE_GRPC_HOST="${MARKETPLACE_GRPC_HOST-}"
_PRESET_MARKETPLACE_GRPC_PORT="${MARKETPLACE_GRPC_PORT-}"
set -a
source .env
set +a
if [ -n "${_PRESET_WEB_PORT}" ]; then
	export WEB_PORT="${_PRESET_WEB_PORT}"
fi
if [ -n "${_PRESET_API_PORT}" ]; then
	export API_PORT="${_PRESET_API_PORT}"
fi
if [ -n "${_PRESET_MARKETPLACE_GRPC_HOST}" ]; then
	export MARKETPLACE_GRPC_HOST="${_PRESET_MARKETPLACE_GRPC_HOST}"
fi
if [ -n "${_PRESET_MARKETPLACE_GRPC_PORT}" ]; then
	export MARKETPLACE_GRPC_PORT="${_PRESET_MARKETPLACE_GRPC_PORT}"
fi

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}EVY End-to-End Test Runner${NC}"
echo -e "${YELLOW}========================================${NC}"

# Run a command (stdout/stderr discarded) until it succeeds or max retries.
retry_until_cmd() {
    local description="$1"
    shift
    local retry_count=0
    echo "Waiting for $description..."
    until "$@" > /dev/null 2>&1 || [ "$retry_count" -eq "$MAX_RETRIES" ]; do
        sleep "$RETRY_DELAY_SECONDS"
        retry_count=$((retry_count + 1))
    done
    if [ "$retry_count" -eq "$MAX_RETRIES" ]; then
        echo -e "${RED}$description failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}$description is ready${NC}"
}

cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    if [ "$NO_DOCKER" = true ]; then
        if [ -n "${WEB_PID}" ]; then
            kill "$WEB_PID" 2>/dev/null || true
        fi
        if [ -n "${MARKETPLACE_PID}" ]; then
            kill "$MARKETPLACE_PID" 2>/dev/null || true
        fi
        if [ -n "${API_PID}" ]; then
            kill "$API_PID" 2>/dev/null || true
        fi
        wait "${WEB_PID}" 2>/dev/null || true
        wait "${API_PID}" 2>/dev/null || true
        wait "${MARKETPLACE_PID}" 2>/dev/null || true
    else
        docker compose down -v --remove-orphans 2>/dev/null || true
    fi
}

wait_for_http_service() {
    local service_name="$1"
    local service_url="$2"
    retry_until_cmd "$service_name" curl -fsS "$service_url"
}

wait_for_postgres_no_docker() {
    local host="${DB_DOMAIN}"
    local port="${DB_PORT}"
    retry_until_cmd "PostgreSQL" bash -c "echo -n > /dev/tcp/${host}/${port}"
}

wait_for_api_readiness() {
    local script_name="$1"
    local display_name="$2"
    if [ "$NO_DOCKER" = true ]; then
        retry_until_cmd "$display_name" bash -c "cd \"$REPO_ROOT/api\" && bun run \"$script_name\""
    else
        retry_until_cmd "$display_name" bash -c "cd \"$REPO_ROOT\" && docker compose exec -T api bun run \"$script_name\""
    fi
}

wait_for_marketplace_readiness() {
    local script_name="$1"
    local display_name="$2"
    if [ "$NO_DOCKER" = true ]; then
        retry_until_cmd "$display_name" bash -c "cd \"$REPO_ROOT/services/marketplace\" && bun run \"$script_name\""
    else
        retry_until_cmd "$display_name" bash -c "cd \"$REPO_ROOT\" && docker compose exec -T marketplace bun run \"$script_name\""
    fi
}

extract_ios_simulator_destination() {
    local destination_line="$1"
    local destination_id="${destination_line#*id:}"
    destination_id="${destination_id%%,*}"

    if [ -z "$destination_id" ] || [[ "$destination_id" == dvtdevice-*placeholder* ]]; then
        return 1
    fi

    printf 'platform=iOS Simulator,id=%s' "$destination_id"
}

resolve_ios_simulator_destination() {
    if [ -n "${IOS_SIMULATOR_DESTINATION:-}" ]; then
        printf '%s' "$IOS_SIMULATOR_DESTINATION"
        return 0
    fi

    local destinations_output
    if ! destinations_output="$(xcodebuild -showdestinations -project evy.xcodeproj -scheme evy 2>/dev/null)"; then
        return 1
    fi

    local destination_line
    local resolved_destination
    while IFS= read -r destination_line; do
        if [[ "$destination_line" == *"platform:iOS Simulator"* ]]; then
            resolved_destination="$(extract_ios_simulator_destination "$destination_line" || true)"
            if [ -n "$resolved_destination" ]; then
                printf '%s' "$resolved_destination"
                return 0
            fi
        fi
    done <<< "$destinations_output"

    return 1
}

seed_database() {
    if ! bun db:seed; then
        echo -e "${RED}Database seeding failed${NC}"
        exit 1
    fi

    wait_for_api_readiness "health:seeded" "seeded API data"
    wait_for_marketplace_readiness "health:seeded" "seeded marketplace data"
}

trap cleanup EXIT

echo -e "\n${YELLOW}Installing dependencies...${NC}"
bun run install:all

if [ "$NO_DOCKER" = true ]; then
    echo -e "\n${YELLOW}Step 1: Starting services without Docker...${NC}"
    wait_for_postgres_no_docker

    echo "Starting Marketplace (background)..."
    (
        cd "$REPO_ROOT/services/marketplace"
        exec bun run start
    ) &
    MARKETPLACE_PID=$!

    wait_for_marketplace_readiness "health" "Marketplace"

    echo "Starting API (background)..."
    (
        cd "$REPO_ROOT/api"
        exec bun run start
    ) &
    API_PID=$!

    wait_for_api_readiness "health" "API"

    echo "Starting Web (background)..."
    (
        cd "$REPO_ROOT/web"
        exec bun run start
    ) &
    WEB_PID=$!

    echo -e "\n${YELLOW}Step 2: Waiting for services to be healthy...${NC}"
    wait_for_http_service "Web" "http://localhost:$WEB_PORT"
else
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1

    echo -e "\n${YELLOW}Step 1: Starting services with docker compose...${NC}"
    docker compose up --build -d

    echo -e "\n${YELLOW}Step 2: Waiting for services to be healthy...${NC}"

    retry_until_cmd "PostgreSQL" bash -c "cd \"$REPO_ROOT\" && docker compose exec -T postgres pg_isready -U \"$DB_USER\""

    wait_for_marketplace_readiness "health" "Marketplace"

    wait_for_api_readiness "health" "API"
    wait_for_http_service "Web" "http://localhost:$WEB_PORT"
fi

echo -e "\n${YELLOW}Step 3: Generating types...${NC}"
if ! bun types:generate; then
    echo -e "${RED}Type generation failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 4: Running API e2e tests...${NC}"
seed_database
cd api
if bun run test:e2e; then
    echo -e "${GREEN}API e2e tests passed${NC}"
else
    echo -e "${RED}API e2e tests failed${NC}"
    API_RESULT=1
fi
cd ..

echo -e "\n${YELLOW}Step 5: Running Web e2e tests...${NC}"
seed_database
cd web
if bun run test:e2e; then
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
    seed_database
    cd ios
    IOS_DESTINATION="$(resolve_ios_simulator_destination)"
    if [ -z "$IOS_DESTINATION" ]; then
        echo -e "${RED}Unable to resolve an available iOS simulator destination${NC}"
        echo "Available destinations:"
        xcodebuild -showdestinations -project evy.xcodeproj -scheme evy || true
        IOS_RESULT=1
    else
        echo "Using iOS simulator destination: $IOS_DESTINATION"
        if xcodebuild test \
            -project evy.xcodeproj \
            -scheme evy \
            -destination "$IOS_DESTINATION" \
            -parallel-testing-enabled YES \
            -parallel-testing-worker-count 2 \
            -quiet; then
            echo -e "${GREEN}iOS e2e tests passed${NC}"
        else
            echo -e "${RED}iOS e2e tests failed${NC}"
            IOS_RESULT=1
        fi
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
