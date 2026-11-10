# Setup & operations

This is a multi-tenant SaaS: one deployment and one Supabase project serve many schools.
Each school signs up, creates its own workspace, and invites its own staff. A school can
only ever see its own students, payments and receipts — that isolation is enforced by
Postgres row-level security, not just the UI.

You (the platform operator) set this up once. Schools never touch SQL.

## 1. Supabase project and environment

Create a project at supabase.com, then set these in your hosting/Bolt environment:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 2. Run the migrations, in order

In **SQL Editor**, run each file in `supabase/migrations/` in filename order:

| File | What it does |
|---|---|
| `…0000_school_fees_schema.sql` | Core tables (students, fee tiers, balances, payments, receipts…) |
| `…0001_seed_fee_tiers.sql` | Superseded — kept for history; `0004` deletes its global seed rows |
| `…0002_allow_self_signup.sql` | Superseded by `0004` |
| `…0003_archive_students.sql` | Soft-delete for students |
| `…0004_multi_tenant.sql` | **Multi-tenancy**: schools, per-school data, new RLS, invites, onboarding functions |

**Already ran 0000–0003 on a single-school install?** Just run `0004`. Your existing data is
carried over into one school called **"My School"** (rename it in Settings), and your existing
users keep their roles in it. Nothing is lost. Anyone who had signed up but never got a profile
is moved into the "create or join a school" flow.

## 3. Your first school

Open the app, **Sign Up**, then choose **Create a school**. The creator becomes that school's
bursar, and the school is seeded with Boarding / Tuition / Transport fee categories (editable in
Settings → Fee structure). No SQL needed.

From **Settings → Team** the bursar creates invite codes for the school's director, teachers, or
other bursars. A colleague signs up, picks **Join with a code**, and lands in the right school
with the right role. Codes expire after 14 days and can be limited to a number of uses.

## 4. Operator tasks (you, in the SQL Editor)

**Verify a school's paybill.** Schools can *claim* a paybill in Settings, but M-Pesa payments
only auto-route to it once you've confirmed they own it. (Otherwise anyone could claim another
school's paybill and receive its payments.) After checking — e.g. against their Daraja/paybill
documentation:

```sql
update schools set paybill_verified = true where id = '<school id>';
```

Only one school can hold a given paybill as verified; changing a paybill in Settings clears
verification until you re-check it.

**See your tenants:**

```sql
select id, name, paybill_number, paybill_verified, subscription_status, trial_ends_at, created_at
from schools order by created_at desc;
```

**Change a subscription state** (billing isn't automated yet — see below):

```sql
update schools set subscription_status = 'active' where id = '<school id>';
-- 'trialing' | 'active' | 'past_due' | 'cancelled'
```

**Delete a school and all its data** (irreversible; its members return to the onboarding screen):

```sql
delete from schools where id = '<school id>';
```

## 5. Live M-Pesa payments

One Edge Function serves every school. It reads the paybill Safaricom reports, finds the
**verified** school that owns it, and reconciles the payment inside that school only.

```bash
supabase functions deploy mpesa-c2b-confirmation --no-verify-jwt
supabase secrets set WEBHOOK_SECRET="<a long random string>"
```

`--no-verify-jwt` is needed because Safaricom can't send a Supabase token; the shared
`WEBHOOK_SECRET` in the callback URL is what stops anyone else posting fake payments.
Register this as the C2B **Confirmation URL**:

```
https://<project-ref>.supabase.co/functions/v1/mpesa-c2b-confirmation?secret=<WEBHOOK_SECRET>
```

Two things to plan for:

- **Who registers the URL with Safaricom?** Registering a C2B URL for a paybill needs access to
  that paybill's Daraja setup, which belongs to the school (or its bank/PSP). Each school has to
  point its own paybill at your URL (or you work through an aggregator). Verifying the paybill in
  step 4 is your check that they really own it.
- **Payments for an unverified paybill are not stored** — there's no school to file them under.
  They're acknowledged to Safaricom and written to the function's logs (Supabase → Edge
  Functions → Logs) so you can see them. Verify the school's paybill *before* they go live.

Until a school's paybill is verified and registered, it can still record cash payments and
manually match payments in the app.

## 6. Not built yet

- **Billing.** The data model has subscription status and a 30-day trial date, and Settings
  shows them, but nothing charges anyone or locks an expired trial.
- **New-term rollover.** Changing a school's current term doesn't copy fees forward. The bursar
  adds the new term's balances per student; a "start new term" action would be a natural next step.
- **Platform admin UI.** Operator tasks above are SQL for now.
- **Email invites.** Invites are codes the bursar shares by hand.
- **eTIMS submission.** Receipts are laid out for eTIMS (KRA PIN, sequential per-school numbers,
  QR code, tax line), but nothing is submitted to KRA. That needs each school's own OSCU/VSCU
  registration and API credentials from KRA.

## Product name

The product is called **FeeDesk** as a placeholder. Change `PRODUCT_NAME` in
`src/lib/product.ts` and it updates everywhere.
