#!/bin/bash
# Rebuilds the test DB (needs a local PostgreSQL and root/postgres access): Supabase-like harness + migrations 0-3 + legacy single-school data.
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../migrations"
service postgresql start >/dev/null 2>&1; sleep 4
su postgres -c "psql -q -c 'drop database if exists t;' -c 'create database t;'" >/dev/null 2>&1
su postgres -c "psql -q -c 'create role authenticated nologin' -c 'create role anon nologin' -c 'create role service_role nologin bypassrls'" >/dev/null 2>&1
su postgres -c "psql -q -d t -f $HERE/harness.sql" >/dev/null 2>&1
for f in 0 1 2 3; do su postgres -c "psql -v ON_ERROR_STOP=1 -q -d t -f $MIG/2026091000000${f}_*.sql" 2>&1 | grep -i error; done
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d t -f $HERE/legacy_data.sql" 2>&1 | grep -i error
echo "test DB ready (legacy single-school state)"
