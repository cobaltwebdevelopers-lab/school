# Database tests

`./run.sh` builds a throwaway Postgres database with a minimal Supabase-style `auth` schema,
loads realistic *single-school* data, applies the multi-tenant migration, and then runs
adversarial checks (cross-school reads/writes, privilege escalation, invite abuse, paybill
squatting, receipt numbering, tenant deletion). It prints `ALL ISOLATION TESTS PASSED` or the
failing checks.

Needs a local PostgreSQL and root access (it uses `su postgres`). It never touches your Supabase
project. Re-run it after any migration that touches tenancy or RLS.
