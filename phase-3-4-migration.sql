-- Run after the original schema.sql when upgrading an existing CREOVATE project.
-- Review in Supabase before production use. This migration contains no secrets.

alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists currency text not null default 'NGN';
alter table public.orders add column if not exists tx_ref text;
alter table public.orders add column if not exists flutterwave_transaction_id text;
alter table public.orders add column if not exists payment_verified_at timestamptz;
create unique index if not exists orders_tx_ref_unique on public.orders(tx_ref) where tx_ref is not null;

alter table public.validator_checks add column if not exists provider text;
alter table public.validator_checks add column if not exists search_count integer not null default 0;
alter table public.validator_checks add column if not exists estimated_cost_minor integer not null default 0;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null unique,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.webhook_events enable row level security;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = uid
        and role = 'admin'
        and lower(coalesce(email, '')) = 'olanitealabij2023@gmail.com'
    );
$$;

create or replace function public.reserve_launch_spot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_service public.services%rowtype;
  current_settings public.site_settings%rowtype;
  base_price integer;
begin
  select * into selected_service from public.services where slug = new.service_slug;
  if selected_service.slug is null then
    raise exception 'Unknown service: %', new.service_slug;
  end if;

  select * into current_settings from public.site_settings where id = 1 for update;
  if current_settings.launch_active and current_settings.launch_spots_remaining > 0 then
    base_price := selected_service.launch_price;
    update public.site_settings
      set launch_spots_remaining = greatest(launch_spots_remaining - 1, 0),
          launch_active = case when launch_spots_remaining <= 1 then false else launch_active end,
          updated_at = now()
      where id = 1;
  else
    base_price := selected_service.standard_price;
  end if;

  if coalesce(new.rush, false) and selected_service.rush_enabled then
    base_price := round(base_price * (1 + selected_service.rush_percent / 100.0));
  end if;

  new.service_name := selected_service.name;
  new.price := base_price;
  new.currency := 'NGN';
  new.rush := coalesce(new.rush, false);
  new.status := 'new';
  new.payment_status := 'pending';
  new.paid_at := null;
  new.flutterwave_transaction_id := null;
  new.payment_verified_at := null;
  return new;
end;
$$;

drop policy if exists validator_checks_insert_own on public.validator_checks;
revoke insert on public.validator_checks from authenticated;
grant select on public.validator_checks to authenticated;
drop policy if exists orders_insert_own on public.orders;
revoke insert on public.orders from authenticated;
grant select on public.orders to authenticated;

-- After signing up with the owner email, run once:
-- update public.profiles set role = 'admin' where lower(email) = 'olanitealabij2023@gmail.com';
