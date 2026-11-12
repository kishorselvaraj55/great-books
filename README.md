# Great Books

Cloud-based billing and business management software for multiple companies, users, and industries. This repository is a **starter implementation**: it includes the Next.js app shell, Supabase authentication, a dashboard shell, module landing pages, and a multi-tenant PostgreSQL schema with Row Level Security (RLS). Transaction entry screens, PDF generation, invitations, payroll calculations, and production reporting are intentionally staged for subsequent implementation rather than represented as finished features.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth with SSR cookies
- Supabase PostgreSQL + RLS
- Responsive CSS and Lucide icons

## Requirements

- Node.js 20.9+ recommended
- npm
- A Supabase project

## Run locally

1. Extract the project and open a terminal in the `great-books` folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. In Supabase, open **SQL Editor** and run `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local` and set your Supabase project URL and publishable/anon key. These are public client credentials; never put a service-role key in a `NEXT_PUBLIC_` variable.
5. In Supabase Authentication settings, configure your site URL to `http://localhost:3000` and add the appropriate redirect URLs.
6. Create a test user in Supabase Authentication (or enable your chosen sign-up flow).
7. Start the development server:

   ```bash
   npm run dev
   ```

8. Open `http://localhost:3000/login`.

## Supabase environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

The Supabase publishable/anon key is expected to be available in browser code. Database permissions must be enforced with RLS. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.**

## Database and tenant security

- Every business data table has a `company_id`.
- RLS policies check active company membership for reads and restrict writes to authorized company roles.
- `owner` and `admin` can manage company settings and user memberships; `manager` can perform common record operations; staff/viewer permissions should be refined module-by-module before production.
- `module_permissions` supports per-user module capabilities. Apply `can_access_module()` in both server-side action logic and RLS policies for fine-grained permissions before enabling staff access to sensitive records.
- Use private Supabase Storage buckets and storage policies that validate the company membership/path. Do not make employee files or company documents public.
- Company onboarding uses the `create_company_for_current_user()` security-definer RPC. It derives the owner from `auth.uid()` and atomically creates the company and owner membership; callers cannot select another owner.
- Audit logs should be inserted by trusted server actions for sensitive financial changes. Add immutable event policies and stronger logging before production.

## Modules represented in the UI

Home dashboard; Purchase; Sales; Debtors; Creditors; Items & Inventory; Employees; Attendance & Salary; Documents; Invite Users; Reports; Settings.

The dashboard currently uses illustrative zero values and placeholder chart data. Do not use it as a financial report until it is wired to validated database queries. Module pages are structured placeholders, not completed transaction workflows.

## Suggested implementation order

1. Company onboarding and active-company selector, with trusted owner membership creation.
2. Company-scoped CRUD for customers, vendors, and items; add server-side permission checks.
3. Sales invoice creation, GST rules, invoice numbering, PDF generation, and payments.
4. Purchase bills, expenses, creditor/debtor ageing, and reconciliation.
5. Inventory ledger and stock movements (avoid relying only on opening stock).
6. Employee attendance, salary policies, payslips, and approvals.
7. Private document storage, email invitations, reports/exports, audit events, backups, and subscription billing.
8. Automated tests, security review, GST/accounting validation, and deployment.

## Before production

- Add automated tests for cross-tenant access and role escalation.
- Add server actions/route handlers for all writes; never trust company IDs or roles supplied by the browser without checking them server-side.
- Review RLS policies with Supabase advisors and a security professional.
- Validate GST treatment and invoice requirements with a qualified accountant.
- Configure backups, monitoring, rate limits, email delivery, and privacy/retention policies.
