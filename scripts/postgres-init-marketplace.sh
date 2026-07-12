#!/usr/bin/env bash
# Extra database for the marketplace service (POSTGRES_DB / DB_EVY_DATABASE is the core EVY DB).
#
# Runs as a docker-entrypoint-initdb.d script, so it only executes once, on first
# container init against an empty data directory. Reads the database name from the
# container's own environment (passed through from DB_MARKETPLACE_DATABASE in .env)
# so the name has a single source of truth instead of being hardcoded here and in CI.
set -euo pipefail

DB_NAME="${DB_MARKETPLACE_DATABASE:-marketplace}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	SELECT 'CREATE DATABASE "${DB_NAME}"'
	WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
EOSQL
