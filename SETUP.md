# Setup

## 1. Create a Supabase project

Create a new project at supabase.com, then grab your **Project URL** and
**anon/public key** from Project Settings → API.

## 2. Add environment variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run the migrations

In the Supabase dashboard, open **SQL Editor** and run these two files, in order:

1. `supabase/migrations/20260910000000_school_fees_schema.sql` — creates every
   table (students, fee tiers, balances, parent phone mappings, payments,
   payment allocations, receipts) plus row-level security policies for all
   three roles (bursar, director, teacher).
2. `supabase/migrations/20260910000001_seed_fee_tiers.sql` — seeds the three
   default fee categories (Boarding, Tuition, Transport) in payment-priority
   order. Edit this file first if your school's fee categories differ.
3. `supabase/migrations/20260910000002_allow_self_signup.sql` — allows
   visitors to create their own account from the landing page. New accounts
   always start as `teacher` (least-privileged role) — this is enforced by
   the database itself, so it can't be bypassed even by calling the API
   directly. Bursar and director accounts still need to be created the
   manual way below.
4. `supabase/migrations/20260910000003_archive_students.sql` — adds support
   for removing a student from the active roster without destroying their
   payment history (see step 5 below).

## 4. Create your first bursar account

Anyone can now sign up from the landing page, but self-signup only ever
grants the `teacher` role. For your first bursar (or director) login:

1. In the Supabase dashboard, go to **Authentication → Users → Add user**
   and create a user with an email and password.
2. In **SQL Editor**, run (replacing the email):

   ```sql
   insert into profiles (id, full_name, role)
   select id, 'Your Name', 'bursar'
   from auth.users
   where email = 'you@example.com';
   ```

Repeat for any director accounts, or for a teacher account you'd rather
provision yourself instead of having them sign up. There's currently no
admin UI for managing staff accounts — this SQL is the way to add or change
roles for now.

## 5. Add your students

Once signed in as a bursar, use the **Add Student** button on the dashboard —
it captures the student's details and their opening fee balances (Boarding,
Tuition, Transport) for the current term in one step. Removing a student
from there archives them rather than deleting their record outright, since
their payment history needs to stay intact for financial record-keeping —
they'll just drop off the active roster, ledger, and teacher clearance list.

## 6. Connect real M-Pesa payments (optional but recommended)

Without this step, payments only enter the system if a bursar records them
manually (cash payments) — there's no live connection to Safaricom yet.

A Supabase Edge Function is included at
`supabase/functions/mpesa-c2b-confirmation` that receives Safaricom Daraja's
C2B "Confirmation" callback, records the payment, and immediately
auto-reconciles it (known phone mapping first, then fuzzy admission-number
matching) — exactly the same priority order the app uses everywhere else.
Only genuinely ambiguous or unmatched payments are left for the bursar to
resolve by hand.

1. Install the Supabase CLI and log in, then from the project root:

   ```bash
   supabase functions deploy mpesa-c2b-confirmation --no-verify-jwt
   ```

   `--no-verify-jwt` is required — Safaricom's callback can't send a Supabase
   auth token, so this one function has to accept unauthenticated requests.
   (This is safe: it only accepts Daraja's specific payload shape and can't
   be used to read or modify anything else.)

2. Register the deployed function's URL with Safaricom as your C2B
   **Confirmation URL** (via the Daraja portal, or your own
   `RegisterURL` API call) — you'll need a Safaricom Daraja developer account
   and your school's paybill number for this part, which only the school can
   set up.

3. If your fee terms don't match the default `'Term 2 2026'` used elsewhere
   in the app, set a `CURRENT_TERM` secret on the function so it allocates
   against the right term:

   ```bash
   supabase secrets set CURRENT_TERM="Term 1 2027"
   ```

## On eTIMS

Receipts are laid out to match KRA eTIMS conventions (KRA PIN, sequential
receipt number, QR code, tax-treatment line), but nothing here actually
submits to KRA's systems — that requires the school's own OSCU/VSCU
registration and API credentials from KRA, which only the school itself
can obtain. Once you have those credentials, the receipt's data model
(SCHOOL.kraPin in `src/mockData.ts`, plus the receipt/QR payload in
`src/components/ReceiptModal.tsx`) is where that integration would plug in.
