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
for arg in "$@"; do
    case $arg in
        --skip-ios) SKIP_IOS=true ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            echo "Usage: ./run-e2e.sh [--skip-ios]"
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
REQUESTED_SERVICE_MODE="${E2E_SERVICE_MODE:-auto}"
SERVICE_MODE=""
LOCAL_SERVICE_PIDS=""
POSTGRES_STARTED_BY_E2E=false
E2E_RUNTIME_DIR="$REPO_ROOT/.e2e"
E2E_LOG_DIR="$E2E_RUNTIME_DIR/logs"
POSTGRES_DATA_DIR="$E2E_RUNTIME_DIR/postgres"
POSTGRES_PASSWORD_FILE="$E2E_RUNTIME_DIR/postgres-password"
POSTGRES_LOG_FILE="$E2E_LOG_DIR/postgres.log"
API_LOG_FILE="$E2E_LOG_DIR/api.log"
MARKETPLACE_LOG_FILE="$E2E_LOG_DIR/marketplace.log"
WEB_LOG_FILE="$E2E_LOG_DIR/web.log"
PG_CTL=""
INITDB=""
PG_ISREADY=""
CREATEDB=""

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

command_exists() {
    command -v "$1" > /dev/null 2>&1
}

find_postgres_bin_dir() {
    local candidate_dir
    for candidate_dir in \
        /opt/homebrew/opt/postgresql@18/bin \
        /usr/local/opt/postgresql@18/bin \
        /opt/homebrew/opt/postgresql@17/bin \
        /usr/local/opt/postgresql@17/bin \
        /opt/homebrew/opt/postgresql@16/bin \
        /usr/local/opt/postgresql@16/bin \
        /opt/homebrew/opt/postgresql/bin \
        /usr/local/opt/postgresql/bin; do
        if [ -x "$candidate_dir/postgres" ] && [ -x "$candidate_dir/pg_ctl" ] && [ -x "$candidate_dir/initdb" ] && [ -x "$candidate_dir/pg_isready" ] && [ -x "$candidate_dir/createdb" ]; then
            printf '%s' "$candidate_dir"
            return 0
        fi
    done

    if command_exists postgres; then
        local postgres_path
        local postgres_bin_dir
        postgres_path="$(command -v postgres)"
        postgres_bin_dir="${postgres_path%/*}"
        if [ -x "$postgres_bin_dir/pg_ctl" ] && [ -x "$postgres_bin_dir/initdb" ] && [ -x "$postgres_bin_dir/pg_isready" ] && [ -x "$postgres_bin_dir/createdb" ]; then
            printf '%s' "$postgres_bin_dir"
            return 0
        fi
    fi

    return 1
}

resolve_service_mode() {
    case "$REQUESTED_SERVICE_MODE" in
        docker)
            SERVICE_MODE="docker"
            ;;
        local)
            SERVICE_MODE="local"
            ;;
        auto)
            if command_exists docker && docker compose version > /dev/null 2>&1; then
                SERVICE_MODE="docker"
            else
                SERVICE_MODE="local"
            fi
            ;;
        *)
            echo -e "${RED}Unknown E2E_SERVICE_MODE: $REQUESTED_SERVICE_MODE${NC}"
            echo "Use E2E_SERVICE_MODE=auto, docker, or local."
            exit 1
            ;;
    esac

    echo "Using $SERVICE_MODE service mode"
}

require_e2e_env() {
    local env_name="$1"
    if [ -z "${!env_name:-}" ]; then
        echo -e "${RED}$env_name environment variable is not set${NC}"
        exit 1
    fi
}

require_postgres_commands() {
    local postgres_bin_dir
    postgres_bin_dir="$(find_postgres_bin_dir || true)"

    if [ -z "$postgres_bin_dir" ]; then
        echo -e "${RED}PostgreSQL server tools are required for E2E_SERVICE_MODE=local${NC}"
        echo "Install PostgreSQL 16 or run with Docker available."
        exit 1
    fi

    PATH="$postgres_bin_dir:$PATH"
    export PATH
    PG_CTL="$postgres_bin_dir/pg_ctl"
    INITDB="$postgres_bin_dir/initdb"
    PG_ISREADY="$postgres_bin_dir/pg_isready"
    CREATEDB="$postgres_bin_dir/createdb"
}

configure_local_service_env() {
    export DB_DOMAIN=127.0.0.1
    export MARKETPLACE_GRPC_HOST=127.0.0.1
}

ensure_local_database() {
    local database_name="$1"
    PGPASSWORD="$DB_PASS" "$CREATEDB" -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" "$database_name"
}

start_local_postgres() {
    require_e2e_env DB_USER
    require_e2e_env DB_PASS
    require_e2e_env DB_PORT
    require_e2e_env DB_EVY_DATABASE
    require_e2e_env DB_MARKETPLACE_DATABASE
    require_postgres_commands

    mkdir -p "$E2E_LOG_DIR"
    rm -rf "$POSTGRES_DATA_DIR"
    printf '%s\n' "$DB_PASS" > "$POSTGRES_PASSWORD_FILE"

    "$INITDB" \
        -D "$POSTGRES_DATA_DIR" \
        -U "$DB_USER" \
        --pwfile="$POSTGRES_PASSWORD_FILE" \
        --auth-local=trust \
        --auth-host=scram-sha-256 \
        --encoding=UTF8 \
        > "$POSTGRES_LOG_FILE" \
        2>&1
    rm -f "$POSTGRES_PASSWORD_FILE"

    {
        echo "port = $DB_PORT"
        echo "listen_addresses = '127.0.0.1'"
    } >> "$POSTGRES_DATA_DIR/postgresql.conf"

    "$PG_CTL" -D "$POSTGRES_DATA_DIR" -l "$POSTGRES_LOG_FILE" start
    POSTGRES_STARTED_BY_E2E=true
    retry_until_cmd "local PostgreSQL" "$PG_ISREADY" -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER"

    ensure_local_database "$DB_EVY_DATABASE"
    ensure_local_database "$DB_MARKETPLACE_DATABASE"
}

start_local_service() {
    local service_name="$1"
    local log_file="$2"
    shift 2

    echo "Starting $service_name (logs: $log_file)..."
    "$@" > "$log_file" 2>&1 &
    local pid=$!
    LOCAL_SERVICE_PIDS="$LOCAL_SERVICE_PIDS $pid"

    sleep 1
    if ! kill -0 "$pid" 2>/dev/null; then
        echo -e "${RED}$service_name failed to start${NC}"
        cat "$log_file" || true
        exit 1
    fi
}

start_docker_services() {
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

    docker compose up --build -d
}

start_local_services() {
    configure_local_service_env
    start_local_postgres
    start_local_service "Marketplace" "$MARKETPLACE_LOG_FILE" bun run --cwd services/marketplace start
    start_local_service "API" "$API_LOG_FILE" bun run --cwd api start
    start_local_service "Web" "$WEB_LOG_FILE" bun run --cwd web start
}

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
    rm -f "$POSTGRES_PASSWORD_FILE"

    if [ "$SERVICE_MODE" = "docker" ]; then
        docker compose down -v --remove-orphans 2>/dev/null || true
        return
    fi

    if [ "$SERVICE_MODE" = "local" ]; then
        local pid
        for pid in $LOCAL_SERVICE_PIDS; do
            kill "$pid" 2>/dev/null || true
        done
        for pid in $LOCAL_SERVICE_PIDS; do
            wait "$pid" 2>/dev/null || true
        done

        if [ "$POSTGRES_STARTED_BY_E2E" = true ] && [ -x "${PG_CTL:-}" ] && [ -d "$POSTGRES_DATA_DIR" ]; then
            "$PG_CTL" -D "$POSTGRES_DATA_DIR" -m fast stop > /dev/null 2>&1 || true
        fi
    fi
}

wait_for_http_service() {
    local service_name="$1"
    local service_url="$2"
    retry_until_cmd "$service_name" curl -fsS "$service_url"
}

wait_for_api_readiness() {
    local script_name="$1"
    local display_name="$2"
    if [ "$SERVICE_MODE" = "docker" ]; then
        retry_until_cmd "$display_name" bash -c "cd \"$REPO_ROOT\" && docker compose exec -T api bun run \"$script_name\""
    else
        retry_until_cmd "$display_name" bun run --cwd api "$script_name"
    fi
}

wait_for_marketplace_readiness() {
    local script_name="$1"
    local display_name="$2"
    if [ "$SERVICE_MODE" = "docker" ]; then
        retry_until_cmd "$display_name" bash -c "cd \"$REPO_ROOT\" && docker compose exec -T marketplace bun run \"$script_name\""
    else
        retry_until_cmd "$display_name" bun run --cwd services/marketplace "$script_name"
    fi
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

    wait_for_api_readiness "health:seeded" "seeded API data"
    wait_for_marketplace_readiness "health:seeded" "seeded marketplace data"
}

trap cleanup EXIT

echo -e "\n${YELLOW}Installing dependencies...${NC}"
bun run install:all

resolve_service_mode

echo -e "\n${YELLOW}Step 1: Generating types...${NC}"
if ! bun types:generate; then
    echo -e "${RED}Type generation failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 2: Starting services in $SERVICE_MODE mode...${NC}"
if [ "$SERVICE_MODE" = "docker" ]; then
    start_docker_services
else
    start_local_services
fi

echo -e "\n${YELLOW}Step 3: Waiting for services to be healthy...${NC}"

if [ "$SERVICE_MODE" = "docker" ]; then
    retry_until_cmd "PostgreSQL" bash -c "cd \"$REPO_ROOT\" && docker compose exec -T postgres pg_isready -U \"$DB_USER\""
fi

wait_for_marketplace_readiness "health" "Marketplace"

wait_for_api_readiness "health" "API"
wait_for_http_service "Web" "http://localhost:$WEB_PORT"



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

echo -e "\n${YELLOW}Step 4b: Running Marketplace e2e tests...${NC}"
seed_database
cd services/marketplace
if bun run test:e2e; then
    echo -e "${GREEN}Marketplace e2e tests passed${NC}"
else
    echo -e "${RED}Marketplace e2e tests failed${NC}"
    MARKETPLACE_RESULT=1
fi
cd ../..

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
        # Clean simulator to prevent stale data (e.g. SwiftData schema) from crashing the app
        SIM_UDID="${IOS_DESTINATION#*id=}"
        xcrun simctl shutdown "$SIM_UDID" 2>/dev/null || true
        xcrun simctl erase "$SIM_UDID" 2>/dev/null || true
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
