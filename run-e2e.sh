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
CI_MODE=false
for arg in "$@"; do
    case $arg in
        --skip-ios) SKIP_IOS=true ;;
        --ci) CI_MODE=true ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            echo "Usage: ./run-e2e.sh [--skip-ios] [--ci]"
            exit 1
            ;;
    esac
done

API_RESULT=0
MARKETPLACE_RESULT=0
WEB_RESULT=0
IOS_RESULT=0
IOS_SKIPPED=false
MAX_RETRIES=30
RETRY_DELAY_SECONDS=2
API_PID=""
MARKETPLACE_PID=""
WEB_PID=""
IOS_SIM_UDID=""

# Preserve env overrides when sourcing `.env` (e.g. WEB_PORT=3001 ./run-e2e.sh).
_PRESET_WEB_PORT="${WEB_PORT-}"
_PRESET_API_PORT="${API_PORT-}"
_PRESET_API_HOST="${API_HOST-}"
_PRESET_API_URL="${API_URL-}"
_PRESET_MARKETPLACE_WS_HOST="${MARKETPLACE_WS_HOST-}"
_PRESET_MARKETPLACE_WS_PORT="${MARKETPLACE_WS_PORT-}"
set -a
source .env
set +a
export GOOGLE_PLACES_MOCK=true
export STRIPE_MOCK=true
if [ -n "${_PRESET_WEB_PORT}" ]; then
	export WEB_PORT="${_PRESET_WEB_PORT}"
fi
if [ -n "${_PRESET_API_PORT}" ]; then
	export API_PORT="${_PRESET_API_PORT}"
	# `.env` derives API_HOST and API_URL from API_PORT as it is sourced, so they
	# still name the `.env` port. Re-derive them, or the services listen on the
	# override while the tests dial the old port and everything times out.
	export API_HOST="localhost:${API_PORT}"
	export API_URL="ws://${API_HOST}"
fi
# An explicit override of the derived values themselves still wins.
if [ -n "${_PRESET_API_HOST}" ]; then
	export API_HOST="${_PRESET_API_HOST}"
	export API_URL="ws://${API_HOST}"
fi
if [ -n "${_PRESET_API_URL}" ]; then
	export API_URL="${_PRESET_API_URL}"
fi
if [ -n "${_PRESET_MARKETPLACE_WS_HOST}" ]; then
	export MARKETPLACE_WS_HOST="${_PRESET_MARKETPLACE_WS_HOST}"
fi
if [ -n "${_PRESET_MARKETPLACE_WS_PORT}" ]; then
	export MARKETPLACE_WS_PORT="${_PRESET_MARKETPLACE_WS_PORT}"
fi

# Catches both a stale derivation and a future change to `.env`'s formula: the
# failure it prevents is silent (services up, tests dialling nothing).
case "${API_HOST}" in
	*:"${API_PORT}") ;;
	*)
		echo -e "${RED}API_HOST (${API_HOST}) does not use API_PORT (${API_PORT}).${NC}"
		echo "Set API_HOST/API_URL explicitly, or check how .env derives them."
		exit 1
		;;
esac
case "${API_URL}" in
	*"${API_HOST}") ;;
	*)
		echo -e "${RED}API_URL (${API_URL}) does not point at API_HOST (${API_HOST}).${NC}"
		exit 1
		;;
esac

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
    if [ -n "$IOS_SIM_UDID" ]; then
        echo "Erasing iOS simulator $IOS_SIM_UDID"
        xcrun simctl shutdown "$IOS_SIM_UDID" 2>/dev/null || true
        xcrun simctl erase "$IOS_SIM_UDID" 2>/dev/null || true
    fi
    if [ "$CI_MODE" = true ]; then
        local pid
        for pid in "$WEB_PID" "$MARKETPLACE_PID" "$API_PID"; do
            [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
        done
        for pid in "$WEB_PID" "$MARKETPLACE_PID" "$API_PID"; do
            [ -n "$pid" ] && wait "$pid" 2>/dev/null || true
        done
    else
        docker compose down -v --remove-orphans 2>/dev/null || true
    fi
}

wait_for_http_service() {
    local service_name="$1"
    local service_url="$2"
    retry_until_cmd "$service_name" curl -fsS "$service_url"
}

wait_for_postgres() {
    if [ "$CI_MODE" = true ]; then
        retry_until_cmd "PostgreSQL" bash -c "echo -n > /dev/tcp/${DB_DOMAIN}/${DB_PORT}"
    else
        retry_until_cmd "PostgreSQL" bash -c "cd \"$REPO_ROOT\" && docker compose exec -T postgres pg_isready -U \"$DB_USER\""
    fi
}

wait_for_service_readiness() {
    local service_dir="$1"
    local compose_service="$2"
    local script_name="$3"
    local display_name="$4"
    if [ "$CI_MODE" = true ]; then
        retry_until_cmd "$display_name" bash -c "cd \"$REPO_ROOT/$service_dir\" && bun run \"$script_name\""
    else
        retry_until_cmd "$display_name" bash -c "cd \"$REPO_ROOT\" && docker compose exec -T $compose_service bun run \"$script_name\""
    fi
}

start_bun_service() {
    local service_dir="$1"
    ( cd "$REPO_ROOT/$service_dir" && exec bun run start ) &
}

extract_ios_simulator_destination() {
    local destination_line="$1"
    local destination_id="${destination_line#*id:}"
    destination_id="${destination_id%%,*}"

    if [ -z "$destination_id" ] || [[ "$destination_id" == dvtdevice-*placeholder* ]]; then
        return 1
    fi

    # Including arch prevents xcodebuild from warning about multiple matching destinations
    # when the same simulator ID appears for both arm64 and x86_64.
    local arch
    arch="$(extract_ios_simulator_field "$destination_line" "arch" || true)"
    if [ -n "$arch" ]; then
        printf 'platform=iOS Simulator,arch=%s,id=%s' "$arch" "$destination_id"
    else
        printf 'platform=iOS Simulator,id=%s' "$destination_id"
    fi
}

extract_ios_simulator_field() {
    local destination_line="$1"
    local field_name="$2"
    local field_value="${destination_line#*${field_name}:}"

    if [ "$field_value" = "$destination_line" ]; then
        return 1
    fi

    field_value="${field_value%%,*}"
    field_value="${field_value% \}}"
    printf '%s' "$field_value"
}

find_ios_simulator_destination() {
    local destinations_output="$1"
    local preferred_device_name="${2:-}"
    local preferred_os_version="${3:-}"
    local destination_line
    local resolved_destination

    while IFS= read -r destination_line; do
        if [[ "$destination_line" != *"platform:iOS Simulator"* ]]; then
            continue
        fi

        if [ -n "$preferred_device_name" ] &&
            [ "$(extract_ios_simulator_field "$destination_line" "name" || true)" != "$preferred_device_name" ]; then
            continue
        fi

        if [ -n "$preferred_os_version" ] &&
            [ "$(extract_ios_simulator_field "$destination_line" "OS" || true)" != "$preferred_os_version" ]; then
            continue
        fi

        resolved_destination="$(extract_ios_simulator_destination "$destination_line" || true)"
        if [ -n "$resolved_destination" ]; then
            printf '%s' "$resolved_destination"
            return 0
        fi
    done <<< "$destinations_output"

    return 1
}

resolve_ios_simulator_destination() {
    if [ -n "${IOS_SIMULATOR_DESTINATION:-}" ]; then
        printf '%s' "$IOS_SIMULATOR_DESTINATION"
        return 0
    fi

    local preferred_device_name="${IOS_SIMULATOR_DEVICE_NAME:-iPhone 17}"
    local preferred_os_version="${IOS_SIMULATOR_OS_VERSION:-26.5}"
    local destinations_output
    local resolved_destination
    if ! destinations_output="$(xcodebuild -showdestinations -project evy.xcodeproj -scheme evy 2>/dev/null)"; then
        return 1
    fi

    resolved_destination="$(find_ios_simulator_destination "$destinations_output" "$preferred_device_name" "$preferred_os_version" ||
        find_ios_simulator_destination "$destinations_output" "$preferred_device_name" ||
        find_ios_simulator_destination "$destinations_output" || true)"
    if [ -n "$resolved_destination" ]; then
        printf '%s' "$resolved_destination"
        return 0
    fi

    return 1
}

seed_database() {
    if ! bun db:seed; then
        echo -e "${RED}Database seeding failed${NC}"
        exit 1
    fi

    wait_for_service_readiness api api "health:seeded" "seeded API data"
    wait_for_service_readiness services/marketplace marketplace "health:seeded" "seeded marketplace data"
}

trap cleanup EXIT

echo -e "\n${YELLOW}Installing root dependencies...${NC}"
bun install

# Generate shared types before installing app dependencies. The generated files
# are gitignored, so a fresh checkout has none. Bun's file dependencies may copy
# evy-types into each app's node_modules during install, so generation must run
# first for app installs to include generated/ts/index.ts.
echo -e "\n${YELLOW}Generating types...${NC}"
if ! bun types:generate; then
    echo -e "${RED}Type generation failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Installing app dependencies...${NC}"
bun install --cwd api
bun install --cwd web
bun install --cwd services/marketplace

if [ "$CI_MODE" = true ]; then
    echo -e "\n${YELLOW}Starting services with Bun (CI mode)...${NC}"
    wait_for_postgres

    start_bun_service services/marketplace
    MARKETPLACE_PID=$!
    wait_for_service_readiness services/marketplace marketplace "health" "Marketplace"

    start_bun_service api
    API_PID=$!
    wait_for_service_readiness api api "health" "API"

    start_bun_service web
    WEB_PID=$!

    echo -e "\n${YELLOW}Waiting for services to be healthy...${NC}"
    wait_for_http_service "Web" "http://localhost:$WEB_PORT"
else
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1

    # Build each service sequentially to avoid parallel compose build races.
    echo -e "\n${YELLOW}Building services with docker compose...${NC}"
    docker compose build marketplace
    docker compose build api
    docker compose build web

    echo -e "\n${YELLOW}Starting services with docker compose...${NC}"
    docker compose up --no-build -d

    echo -e "\n${YELLOW}Waiting for services to be healthy...${NC}"
    wait_for_postgres

    wait_for_service_readiness services/marketplace marketplace "health" "Marketplace"
    wait_for_service_readiness api api "health" "API"
    wait_for_http_service "Web" "http://localhost:$WEB_PORT"
fi

echo -e "\n${YELLOW}Running API e2e tests...${NC}"
seed_database
cd api
if bun run test:e2e; then
    echo -e "${GREEN}API e2e tests passed${NC}"
else
    echo -e "${RED}API e2e tests failed${NC}"
    API_RESULT=1
fi
cd ..

echo -e "\n${YELLOW}Running Marketplace e2e tests...${NC}"
seed_database
cd services/marketplace
if bun run test:e2e; then
    echo -e "${GREEN}Marketplace e2e tests passed${NC}"
else
    echo -e "${RED}Marketplace e2e tests failed${NC}"
    MARKETPLACE_RESULT=1
fi
cd ../..

echo -e "\n${YELLOW}Running Web e2e tests...${NC}"
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
    echo -e "\n${YELLOW}Skipping iOS e2e tests (--skip-ios flag set)${NC}"
    IOS_SKIPPED=true
else
    echo -e "\n${YELLOW}Running iOS e2e tests...${NC}"
    echo -e "${GREEN}GOOGLE_PLACES_MOCK=true; place search uses API fixtures (no live Google calls)${NC}"
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
        # Clean simulator to prevent stale data (e.g. SwiftData schema) from crashing the app
        IOS_SIM_UDID="${IOS_DESTINATION#*id=}"
        xcrun simctl shutdown "$IOS_SIM_UDID" 2>/dev/null || true
        xcrun simctl erase "$IOS_SIM_UDID" 2>/dev/null || true
        if xcodebuild test \
            -project evy.xcodeproj \
            -scheme evy \
            -destination "$IOS_DESTINATION" \
            -only-testing:evyUITests \
            -parallel-testing-enabled NO \
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

LABEL_WIDTH=12

print_result() {
    local label="$1"
    local color="$2"
    local status="$3"
    printf "%-${LABEL_WIDTH}s ${color}%s${NC}\n" "${label}:" "$status"
}

if [ $API_RESULT -eq 0 ]; then
    print_result "API" "${GREEN}" "PASSED"
else
    print_result "API" "${RED}" "FAILED"
fi

if [ $MARKETPLACE_RESULT -eq 0 ]; then
    print_result "Marketplace" "${GREEN}" "PASSED"
else
    print_result "Marketplace" "${RED}" "FAILED"
fi

if [ $WEB_RESULT -eq 0 ]; then
    print_result "Web" "${GREEN}" "PASSED"
else
    print_result "Web" "${RED}" "FAILED"
fi

if [ "$IOS_SKIPPED" = true ]; then
    print_result "iOS" "${YELLOW}" "SKIPPED"
elif [ $IOS_RESULT -eq 0 ]; then
    print_result "iOS" "${GREEN}" "PASSED"
else
    print_result "iOS" "${RED}" "FAILED"
fi

if [ $API_RESULT -ne 0 ] || [ $MARKETPLACE_RESULT -ne 0 ] || [ $WEB_RESULT -ne 0 ] || ([ "$IOS_SKIPPED" = false ] && [ $IOS_RESULT -ne 0 ]); then
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
fi
