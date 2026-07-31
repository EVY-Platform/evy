#!/bin/bash
# iOS e2e helpers — sourced by run-e2e.sh (shares env, colors, cleanup traps).

IOS_SIM_NAME_B="iPhone 17 E2E-B"
STACK_B_API_PORT=8010
STACK_B_MARKETPLACE_WS_PORT=8011

IOS_SIM_UDID_A=""
IOS_SIM_UDID_B=""
IOS_DESTINATION_A=""
IOS_DESTINATION_B=""
IOS_XCTESTRUN=""
API_B_PID=""
MARKETPLACE_B_PID=""
IOS_BUILD_PID=""
IOS_STACK_B_READY_PID=""

# Bucket A: WebSocketE2ETests, E2EHomeInboxTests, E2EPlaceSearchTests
IOS_BUCKET_A_ONLY_TESTING=(
	"evyUITests/WebSocketE2ETests"
	"evyUITests/E2EHomeInboxTests"
	"evyUITests/E2EPlaceSearchTests"
)

ios_stack_b_env() {
	export API_PORT="${STACK_B_API_PORT}"
	export API_HOST="localhost:${STACK_B_API_PORT}"
	export API_URL="ws://localhost:${STACK_B_API_PORT}"
	export MARKETPLACE_WS_HOST="127.0.0.1"
	export MARKETPLACE_WS_PORT="${STACK_B_MARKETPLACE_WS_PORT}"
	export DB_EVY_DATABASE="evy_b"
	export DB_MARKETPLACE_DATABASE="marketplace_b"
}

extract_ios_simulator_destination() {
	local destination_line="$1"
	local destination_id="${destination_line#*id:}"
	destination_id="${destination_id%%,*}"

	if [ -z "$destination_id" ] || [[ "$destination_id" == dvtdevice-*placeholder* ]]; then
		return 1
	fi

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

ios_simulator_udid_from_destination() {
	local destination="$1"
	printf '%s' "${destination#*id=}"
}

ios_lookup_simulator_udid_by_name() {
	local simulator_name="$1"
	python3 -c '
import json, sys
name = sys.argv[1]
devices = json.load(sys.stdin).get("devices", {})
for runtime_devices in devices.values():
    for device in runtime_devices:
        if device.get("name") == name and device.get("isAvailable", True):
            print(device["udid"])
            raise SystemExit(0)
raise SystemExit(1)
' "$simulator_name" < <(xcrun simctl list -j devices available)
}

ios_create_simulator_b() {
	local preferred_device_name="${IOS_SIMULATOR_DEVICE_NAME:-iPhone 17}"
	local preferred_os_version="${IOS_SIMULATOR_OS_VERSION:-26.5}"
	local device_type_id runtime_id

	device_type_id="$(python3 -c '
import json, sys
name = sys.argv[1]
for device_type in json.load(sys.stdin).get("devicetypes", []):
    if device_type.get("name") == name:
        print(device_type["identifier"])
        raise SystemExit(0)
raise SystemExit(1)
' "$preferred_device_name" < <(xcrun simctl list -j devicetypes))" || return 1

	runtime_id="$(python3 -c '
import json, sys
version = sys.argv[1]
for runtime in json.load(sys.stdin).get("runtimes", []):
    if runtime.get("version") == version and runtime.get("isAvailable", True):
        print(runtime["identifier"])
        raise SystemExit(0)
raise SystemExit(1)
' "$preferred_os_version" < <(xcrun simctl list -j runtimes))" || return 1

	xcrun simctl create "$IOS_SIM_NAME_B" "$device_type_id" "$runtime_id"
}

ios_destination_for_udid() {
	local udid="$1"
	local destinations_output
	local destination_line
	local resolved_destination

	if ! destinations_output="$(xcodebuild -showdestinations -project evy.xcodeproj -scheme evy 2>/dev/null)"; then
		return 1
	fi

	while IFS= read -r destination_line; do
		if [[ "$destination_line" != *"platform:iOS Simulator"* ]] ||
			[[ "$destination_line" != *"id:$udid"* ]]; then
			continue
		fi
		resolved_destination="$(extract_ios_simulator_destination "$destination_line" || true)"
		if [ -n "$resolved_destination" ]; then
			printf '%s' "$resolved_destination"
			return 0
		fi
	done <<< "$destinations_output"

	printf 'platform=iOS Simulator,id=%s' "$udid"
}

ios_resolve_simulators() {
	local preferred_device_name="${IOS_SIMULATOR_DEVICE_NAME:-iPhone 17}"

	cd "$REPO_ROOT/ios"
	IOS_DESTINATION_A="$(resolve_ios_simulator_destination)"
	if [ -z "$IOS_DESTINATION_A" ]; then
		cd "$REPO_ROOT"
		return 1
	fi
	IOS_SIM_UDID_A="$(ios_simulator_udid_from_destination "$IOS_DESTINATION_A")"

	if [ "$CI_MODE" != true ]; then
		IOS_SIM_UDID="$IOS_SIM_UDID_A"
		cd "$REPO_ROOT"
		return 0
	fi

	if ! IOS_SIM_UDID_B="$(ios_lookup_simulator_udid_by_name "$IOS_SIM_NAME_B" 2>/dev/null)"; then
		echo "Creating iOS simulator B: $IOS_SIM_NAME_B ($preferred_device_name)"
		IOS_SIM_UDID_B="$(ios_create_simulator_b)" || {
			cd "$REPO_ROOT"
			return 1
		}
	fi

	IOS_DESTINATION_B="$(ios_destination_for_udid "$IOS_SIM_UDID_B")"
	cd "$REPO_ROOT"
	return 0
}

ios_locate_xctestrun() {
	local found
	found="$(ls "$REPO_ROOT/ios/DerivedData-e2e/Build/Products/"evy_*.xctestrun 2>/dev/null | head -n 1)"
	if [ -z "$found" ] || [ ! -f "$found" ]; then
		echo -e "${RED}Unable to locate evy_*.xctestrun under ios/DerivedData-e2e/Build/Products${NC}"
		return 1
	fi
	# Absolute path: background builds set vars in a subshell that the parent never sees.
	IOS_XCTESTRUN="$(cd "$(dirname "$found")" && pwd)/$(basename "$found")"
}

ios_build_for_testing() {
	echo "Building iOS e2e tests (build-for-testing)..."
	cd "$REPO_ROOT/ios"
	if ! xcodebuild build-for-testing \
		-project evy.xcodeproj \
		-scheme evy \
		-destination "$IOS_DESTINATION_A" \
		-derivedDataPath DerivedData-e2e \
		-quiet; then
		cd "$REPO_ROOT"
		return 1
	fi
	cd "$REPO_ROOT"
	ios_locate_xctestrun
}

ios_start_stack_b_service() {
	local service_dir="$1"
	(
		ios_stack_b_env
		cd "$REPO_ROOT/$service_dir"
		exec bun run start
	) &
}

ios_create_stack_b_databases() {
	createdb -h "$DB_DOMAIN" -p "$DB_PORT" -U "$DB_USER" evy_b 2>/dev/null || true
	createdb -h "$DB_DOMAIN" -p "$DB_PORT" -U "$DB_USER" marketplace_b 2>/dev/null || true
}

ios_wait_for_stack_b_readiness() {
	retry_until_cmd "stack-B Marketplace" bash -c "
		ios_stack_b_env
		cd \"$REPO_ROOT/services/marketplace\" && bun run health
	"
	retry_until_cmd "stack-B API" bash -c "
		ios_stack_b_env
		cd \"$REPO_ROOT/api\" && bun run health
	"
}

ios_seed_stack_b() {
	if [ "$CI_MODE" != true ]; then
		return 0
	fi

	echo "Seeding stack B databases..."
	if ! (
		ios_stack_b_env
		cd "$REPO_ROOT"
		bun db:seed
	); then
		echo -e "${RED}Stack B database seeding failed${NC}"
		return 1
	fi

	retry_until_cmd "stack-B seeded API data" bash -c "
		ios_stack_b_env
		cd \"$REPO_ROOT/api\" && bun run health:seeded
	"
	retry_until_cmd "stack-B seeded marketplace data" bash -c "
		ios_stack_b_env
		cd \"$REPO_ROOT/services/marketplace\" && bun run health:seeded
	"
}

ios_start_stack_b_background() {
	if [ "$CI_MODE" != true ]; then
		return 0
	fi

	# Start services in this shell so MARKETPLACE_B_PID / API_B_PID survive for cleanup.
	# Only readiness + seeding run in the background subshell.
	echo "Starting stack B (API :${STACK_B_API_PORT}, marketplace WS :${STACK_B_MARKETPLACE_WS_PORT})..."
	ios_create_stack_b_databases
	ios_start_stack_b_service services/marketplace
	MARKETPLACE_B_PID=$!
	ios_start_stack_b_service api
	API_B_PID=$!
	(
		ios_wait_for_stack_b_readiness && ios_seed_stack_b
	) &
	IOS_STACK_B_READY_PID=$!
}

ios_wait_for_stack_b_background() {
	if [ "$CI_MODE" != true ] || [ -z "$IOS_STACK_B_READY_PID" ]; then
		return 0
	fi
	if ! wait "$IOS_STACK_B_READY_PID"; then
		echo -e "${RED}Stack B startup or seeding failed${NC}"
		return 1
	fi
}

ios_erase_simulator() {
	local udid="$1"
	xcrun simctl shutdown "$udid" 2>/dev/null || true
	xcrun simctl erase "$udid" 2>/dev/null || true
}

ios_xcodebuild_test_args() {
	local bucket_label="$1"
	local destination="$2"
	local api_host="$3"
	local result_bundle="$4"
	local log_file="$5"
	shift 5
	local -a test_filters=("$@")
	local -a cmd=(
		xcodebuild test-without-building
		-xctestrun "$IOS_XCTESTRUN"
		-destination "$destination"
		-parallel-testing-enabled NO
		-resultBundlePath "$result_bundle"
		-quiet
	)
	local filter
	for filter in "${test_filters[@]}"; do
		cmd+=("$filter")
	done
	(
		cd "$REPO_ROOT/ios"
		TEST_RUNNER_API_HOST="$api_host" "${cmd[@]}"
	) >"$log_file" 2>&1
	local status=$?
	if [ "$status" -ne 0 ]; then
		echo -e "${RED}iOS e2e bucket ${bucket_label} failed (see ${log_file})${NC}"
		cat "$log_file"
	fi
	return "$status"
}

ios_run_tests_parallel() {
	local -a bucket_a_filters=()
	local -a bucket_b_filters=()
	local filter
	for filter in "${IOS_BUCKET_A_ONLY_TESTING[@]}"; do
		bucket_a_filters+=("-only-testing:${filter}")
		bucket_b_filters+=("-skip-testing:${filter}")
	done

	rm -f "$REPO_ROOT/ios-e2e-A.log" "$REPO_ROOT/ios-e2e-B.log"
	rm -rf "$REPO_ROOT/ios/TestResults-A.xcresult" "$REPO_ROOT/ios/TestResults-B.xcresult"

	ios_erase_simulator "$IOS_SIM_UDID_A"
	ios_erase_simulator "$IOS_SIM_UDID_B"

	local bucket_a_status=0 bucket_b_status=0

	ios_xcodebuild_test_args \
		"A" \
		"$IOS_DESTINATION_A" \
		"127.0.0.1:${API_PORT}" \
		"TestResults-A.xcresult" \
		"$REPO_ROOT/ios-e2e-A.log" \
		"${bucket_a_filters[@]}" &
	local pid_a=$!

	# Stagger simulator B slightly to reduce launch-timeout flakiness on CI.
	sleep 10

	ios_xcodebuild_test_args \
		"B" \
		"$IOS_DESTINATION_B" \
		"127.0.0.1:${STACK_B_API_PORT}" \
		"TestResults-B.xcresult" \
		"$REPO_ROOT/ios-e2e-B.log" \
		"${bucket_b_filters[@]}" &
	local pid_b=$!

	wait "$pid_a" || bucket_a_status=$?
	wait "$pid_b" || bucket_b_status=$?

	if [ "$bucket_a_status" -ne 0 ] || [ "$bucket_b_status" -ne 0 ]; then
		return 1
	fi
	return 0
}

ios_run_tests_sequential() {
	cd "$REPO_ROOT/ios"
	ios_erase_simulator "$IOS_SIM_UDID_A"
	if (set -o pipefail; TEST_RUNNER_API_HOST="127.0.0.1:${API_PORT}" xcodebuild test \
		-project evy.xcodeproj \
		-scheme evy \
		-destination "$IOS_DESTINATION_A" \
		-only-testing:evyUITests \
		-parallel-testing-enabled NO \
		-quiet 2>&1 | sed '/IDELaunchParametersSnapshot/d'); then
		cd "$REPO_ROOT"
		return 0
	fi
	cd "$REPO_ROOT"
	return 1
}

ios_run_e2e() {
	if ! ios_resolve_simulators; then
		echo -e "${RED}Unable to resolve an available iOS simulator destination${NC}"
		echo "Available destinations:"
		(cd "$REPO_ROOT/ios" && xcodebuild -showdestinations -project evy.xcodeproj -scheme evy) || true
		return 1
	fi

	if [ -n "$IOS_BUILD_PID" ]; then
		echo "Waiting for background iOS build-for-testing..."
		if ! wait "$IOS_BUILD_PID"; then
			echo -e "${RED}iOS build-for-testing failed${NC}"
			[ -f "$REPO_ROOT/ios-e2e-build.log" ] && cat "$REPO_ROOT/ios-e2e-build.log"
			return 1
		fi
		# Background build ran in a subshell; locate the xctestrun in this shell.
		if ! ios_locate_xctestrun; then
			return 1
		fi
	elif ! ios_build_for_testing; then
		return 1
	fi

	if [ "$CI_MODE" = true ]; then
		if [ -z "$IOS_XCTESTRUN" ] || [ ! -f "$IOS_XCTESTRUN" ]; then
			echo -e "${RED}iOS xctestrun path is missing or invalid: '${IOS_XCTESTRUN}'${NC}"
			return 1
		fi
		echo "Using xctestrun: $IOS_XCTESTRUN"
		if ! ios_wait_for_stack_b_background; then
			return 1
		fi
		echo "Using iOS simulator A: $IOS_DESTINATION_A"
		echo "Using iOS simulator B: $IOS_DESTINATION_B"
		if ios_run_tests_parallel; then
			return 0
		fi
		return 1
	fi

	echo "Using iOS simulator destination: $IOS_DESTINATION_A"
	if ios_run_tests_sequential; then
		return 0
	fi
	return 1
}

ios_cleanup() {
	if [ -n "$IOS_BUILD_PID" ]; then
		kill "$IOS_BUILD_PID" 2>/dev/null || true
		wait "$IOS_BUILD_PID" 2>/dev/null || true
	fi
	if [ -n "$IOS_STACK_B_READY_PID" ]; then
		kill "$IOS_STACK_B_READY_PID" 2>/dev/null || true
		wait "$IOS_STACK_B_READY_PID" 2>/dev/null || true
	fi
	if [ "$CI_MODE" = true ]; then
		local pid
		for pid in "$MARKETPLACE_B_PID" "$API_B_PID"; do
			[ -n "$pid" ] && kill "$pid" 2>/dev/null || true
		done
		for pid in "$MARKETPLACE_B_PID" "$API_B_PID"; do
			[ -n "$pid" ] && wait "$pid" 2>/dev/null || true
		done
	fi
	if [ -n "$IOS_SIM_UDID_A" ]; then
		echo "Erasing iOS simulator A $IOS_SIM_UDID_A"
		ios_erase_simulator "$IOS_SIM_UDID_A"
	fi
	if [ -n "$IOS_SIM_UDID_B" ]; then
		echo "Erasing iOS simulator B $IOS_SIM_UDID_B"
		ios_erase_simulator "$IOS_SIM_UDID_B"
	fi
}
