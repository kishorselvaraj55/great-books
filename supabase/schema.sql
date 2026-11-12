-- Great Books multi-tenant foundation. Run in Supabase SQL Editor.
-- Security model: user data access is always scoped through active company_members rows.
create extension if not exists pgcrypto;

create type public.company_role as enum ('owner','admin','manager','staff','viewer');
create type public.membership_status as enum ('invited','active','disabled');
create type public.document_status as enum ('active','archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  gstin text,
  pan text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'India',
  currency text not null default 'INR',
  financial_year_start_month smallint not null default 4 check(financial_year_start_month between 1 and 12),
  logo_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_role not null default 'staff',
  status public.membership_status not null default 'active',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(company_id,user_id)
);

create table public.module_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id,user_id,module_key)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_code text, name text not null, email text, phone text, gstin text, billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb, payment_terms_days integer not null default 0 check(payment_terms_days>=0), is_active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,customer_code)
);
create table public.vendors (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  vendor_code text, name text not null, email text, phone text, gstin text, address jsonb not null default '{}'::jsonb,
  payment_terms_days integer not null default 0 check(payment_terms_days>=0), is_active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,vendor_code)
);
create table public.items (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  code text, name text not null, description text, item_type text not null default 'product' check(item_type in ('product','service')),
  unit text not null default 'pcs', hsn_sac text, gst_rate numeric(5,2) not null default 0 check(gst_rate between 0 and 100),
  purchase_price numeric(14,2) not null default 0 check(purchase_price>=0), selling_price numeric(14,2) not null default 0 check(selling_price>=0),
  opening_stock numeric(14,3) not null default 0, is_active boolean not null default true, created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,code)
);
create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null, invoice_number text not null, invoice_date date not null default current_date,
  due_date date, status text not null default 'draft' check(status in ('draft','issued','partially_paid','paid','overdue','cancelled')),
  place_of_supply text, supply_type text not null default 'intra_state' check(supply_type in ('intra_state','inter_state')),
  subtotal numeric(14,2) not null default 0, discount_total numeric(14,2) not null default 0, cgst_total numeric(14,2) not null default 0,
  sgst_total numeric(14,2) not null default 0, igst_total numeric(14,2) not null default 0, round_off numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0, amount_paid numeric(14,2) not null default 0, notes text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,invoice_number), check(amount_paid>=0)
);
create table public.sales_invoice_lines (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.sales_invoices(id) on delete cascade, item_id uuid references public.items(id) on delete set null,
  description text not null, hsn_sac text, quantity numeric(14,3) not null default 1 check(quantity>0), unit text not null default 'pcs',
  rate numeric(14,2) not null default 0 check(rate>=0), discount numeric(14,2) not null default 0, gst_rate numeric(5,2) not null default 0,
  taxable_value numeric(14,2) not null default 0, cgst numeric(14,2) not null default 0, sgst numeric(14,2) not null default 0, igst numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0, created_at timestamptz not null default now()
);
create table public.purchase_bills (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null, bill_number text not null, vendor_invoice_number text, bill_date date not null default current_date,
  due_date date, status text not null default 'unpaid' check(status in ('draft','unpaid','partially_paid','paid','cancelled')),
  subtotal numeric(14,2) not null default 0, tax_total numeric(14,2) not null default 0, grand_total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,bill_number)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  category text not null, description text, expense_date date not null default current_date, amount numeric(14,2) not null check(amount>=0),
  payment_method text, attachment_path text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  direction text not null check(direction in ('received','paid')), customer_id uuid references public.customers(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null, invoice_id uuid references public.sales_invoices(id) on delete set null,
  purchase_bill_id uuid references public.purchase_bills(id) on delete set null, payment_date date not null default current_date,
  amount numeric(14,2) not null check(amount>0), method text, reference_number text, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.employees (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_code text not null, full_name text not null, phone text, email text, address jsonb not null default '{}'::jsonb,
  department text, designation text, joining_date date, employment_status text not null default 'active' check(employment_status in ('active','inactive','left')),
  pay_type text not null default 'monthly' check(pay_type in ('monthly','daily')), base_pay numeric(14,2) not null default 0 check(base_pay>=0),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,employee_code)
);
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade, attendance_date date not null,
  status text not null check(status in ('present','absent','half_day','leave','holiday')), overtime_hours numeric(6,2) not null default 0 check(overtime_hours>=0), notes text,
  marked_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(company_id,employee_id,attendance_date)
);
create table public.salary_runs (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade, period_start date not null, period_end date not null,
  paid_days numeric(6,2) not null default 0, overtime_amount numeric(14,2) not null default 0, allowances numeric(14,2) not null default 0,
  deductions numeric(14,2) not null default 0, advance_deduction numeric(14,2) not null default 0, gross_pay numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0, status text not null default 'draft' check(status in ('draft','approved','paid')),
  paid_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now(), check(period_end>=period_start)
);
create table public.documents (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  parent_id uuid references public.documents(id) on delete cascade, name text not null, category text not null default 'general',
  storage_path text, mime_type text, file_size bigint, status public.document_status not null default 'active', uploaded_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.delivery_challans (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null, invoice_id uuid references public.sales_invoices(id) on delete set null,
  challan_number text not null, challan_date date not null default current_date, status text not null default 'draft' check(status in ('draft','dispatched','delivered','cancelled')),
  notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(company_id,challan_number)
);
create table public.audit_logs (
  id bigint generated always as identity primary key, company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index on public.company_members(user_id,status);
create index on public.sales_invoices(company_id,invoice_date);
create index on public.sales_invoices(company_id,due_date,status);
create index on public.purchase_bills(company_id,bill_date);
create index on public.payments(company_id,payment_date);
create index on public.attendance_records(company_id,attendance_date);
create index on public.audit_logs(company_id,created_at desc);

create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.company_members m where m.company_id=target_company and m.user_id=auth.uid() and m.status='active');
$$;
create or replace function public.has_company_role(target_company uuid, allowed_roles public.company_role[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.company_members m where m.company_id=target_company and m.user_id=auth.uid() and m.status='active' and m.role=any(allowed_roles));
$$;
create or replace function public.can_access_module(target_company uuid, target_module text, required_action text default 'can_view')
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_company_role(target_company,array['owner','admin']::public.company_role[])
  or exists(select 1 from public.module_permissions p join public.company_members m on m.company_id=p.company_id and m.user_id=p.user_id and m.status='active'
    where p.company_id=target_company and p.user_id=auth.uid() and p.module_key=target_module and
    case required_action when 'can_create' then p.can_create when 'can_edit' then p.can_edit when 'can_delete' then p.can_delete else p.can_view end);
$$;

-- New user profile is created by a trusted database trigger.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Enable RLS and apply membership-based access. Table-specific write permissions are tightened below.
do $$ declare t text; begin
  foreach t in array array['companies','company_members','module_permissions','customers','vendors','items','sales_invoices','sales_invoice_lines','purchase_bills','expenses','payments','employees','attendance_records','salary_runs','documents','delivery_challans','audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;
alter table public.profiles enable row level security;

create policy "profiles read self" on public.profiles for select to authenticated using(id=auth.uid());
create policy "profiles update self" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "company members can read companies" on public.companies for select to authenticated using(public.is_company_member(id));
create policy "authenticated users create companies" on public.companies for insert to authenticated with check(created_by=auth.uid());
create policy "company admins update companies" on public.companies for update to authenticated using(public.has_company_role(id,array['owner','admin']::public.company_role[])) with check(public.has_company_role(id,array['owner','admin']::public.company_role[]));
create policy "company admins delete companies" on public.companies for delete to authenticated using(public.has_company_role(id,array['owner']::public.company_role[]));
create policy "members read membership list" on public.company_members for select to authenticated using(public.is_company_member(company_id) or user_id=auth.uid());
create policy "company admins manage memberships" on public.company_members for all to authenticated using(public.has_company_role(company_id,array['owner','admin']::public.company_role[])) with check(public.has_company_role(company_id,array['owner','admin']::public.company_role[]));
create policy "users read own module permissions" on public.module_permissions for select to authenticated using(user_id=auth.uid() or public.has_company_role(company_id,array['owner','admin']::public.company_role[]));
create policy "admins manage module permissions" on public.module_permissions for all to authenticated using(public.has_company_role(company_id,array['owner','admin']::public.company_role[])) with check(public.has_company_role(company_id,array['owner','admin']::public.company_role[]));

-- Generic policies: company membership is mandatory for reads; only owners/admins/managers can write by default.
do $$ declare t text; begin
  foreach t in array array['customers','vendors','items','sales_invoices','sales_invoice_lines','purchase_bills','expenses','payments','employees','attendance_records','salary_runs','documents','delivery_challans','audit_logs'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_company_member(company_id))', t||'_member_read',t);
    if t='audit_logs' then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.has_company_role(company_id,array[''owner'',''admin'',''manager'']::public.company_role[]))',t||'_manager_insert',t);
    else
      execute format('create policy %I on public.%I for insert to authenticated with check (public.has_company_role(company_id,array[''owner'',''admin'',''manager'']::public.company_role[]))',t||'_manager_insert',t);
      execute format('create policy %I on public.%I for update to authenticated using (public.has_company_role(company_id,array[''owner'',''admin'',''manager'']::public.company_role[])) with check (public.has_company_role(company_id,array[''owner'',''admin'',''manager'']::public.company_role[]))',t||'_manager_update',t);
      execute format('create policy %I on public.%I for delete to authenticated using (public.has_company_role(company_id,array[''owner'',''admin'']::public.company_role[]))',t||'_admin_delete',t);
    end if;
  end loop;
end $$;

-- Secure onboarding RPC: company and owner membership are created atomically.
-- The caller cannot nominate another owner; the owner is always auth.uid().
create or replace function public.create_company_for_current_user(company_name text, company_gstin text default null, company_email text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_company_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(company_name,''))) < 2 then raise exception 'Company name must be at least 2 characters'; end if;
  insert into public.companies(name,gstin,email,created_by)
    values(trim(company_name),nullif(trim(company_gstin),''),nullif(trim(company_email),''),auth.uid())
    returning id into new_company_id;
  insert into public.company_members(company_id,user_id,role,status)
    values(new_company_id,auth.uid(),'owner','active');
  return new_company_id;
end; $$;
revoke all on function public.create_company_for_current_user(text,text,text) from public;
grant execute on function public.create_company_for_current_user(text,text,text) to authenticated;

