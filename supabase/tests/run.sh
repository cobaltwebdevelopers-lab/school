#!/bin/bash
# Full run: legacy single-school DB -> multi-tenant migration -> isolation tests.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/setup_test_db.sh"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d t -f $HERE/../migrations/20260910000004_multi_tenant.sql" > /dev/null
"$HERE/isolation_test.sh"
