-- Run this once in Supabase SQL Editor for the CREOVATE project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  launch_active boolean not null default true,
  launch_spots_total integer not null default 15 check (launch_spots_total >= 0),
  launch_spots_remaining integer not null default 15 check (launch_spots_remaining >= 0),
  discount_percent integer not null default 30 check (discount_percent between 0 and 100),
  rush_percent integer not null default 30 check (rush_percent between 0 and 100),
  offer_message text not null default '30% off every design service for the first 15 bookings after launch.',
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  slug text primary key,
  name text not null,
  launch_price integer not null check (launch_price >= 0),
  standard_price integer not null check (standard_price >= 0),
  rush_enabled boolean not null default false,
  rush_percent integer not null default 30 check (rush_percent between 0 and 100),
  delivery_time text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text,
  service_slug text not null references public.services(slug),
  service_name text not null,
  price integer not null check (price >= 0),
  currency text not null default 'NGN' check (currency = upper(currency) and length(currency) = 3),
  tx_ref text unique,
  flutterwave_transaction_id text,
  rush boolean not null default false,
  brief jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'in_progress', 'complete', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz,
  payment_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.validator_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idea text not null,
  audience text not null,
  location text not null,
  goal text not null,
  budget text not null,
  score integer not null check (score between 0 and 100),
  verdict text not null,
  result jsonb not null default '{}'::jsonb,
  provider text,
  search_count integer not null default 0 check (search_count >= 0),
  estimated_cost_minor integer not null default 0 check (estimated_cost_minor >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null unique,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
  and exists (
    select 1 from public.profiles
    where id = uid
      and role = 'admin'
      and lower(coalesce(email, '')) = 'olanitealabij2023@gmail.com'
  ); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.site_settings (id) values (1) on conflict (id) do nothing;
insert into public.services (slug, name, launch_price, standard_price, rush_enabled, delivery_time, description) values
  ('logo', 'Logo design', 5600, 8000, false, '24 hours', 'One clean, custom logo from your brief.'),
  ('flyer', 'Flyer / poster', 3500, 5000, false, '24 hours', 'A single-page promo for an event, sale or announcement.'),
  ('social-post', 'Social media post', 2800, 4000, false, '24 hours', 'One designed graphic sized for your platform.'),
  ('social-pack', 'Social media pack', 24500, 35000, true, '5 days', 'Ten matching posts in one consistent style.'),
  ('business-card', 'Business card', 3500, 5000, false, '24 hours', 'A professional card to print or share digitally.'),
  ('brand-kit', 'Full brand kit', 42000, 60000, true, '10 days', 'A complete visual identity for your business.')
on conflict (slug) do update set
  name = excluded.name,
  launch_price = excluded.launch_price,
  standard_price = excluded.standard_price,
  rush_enabled = excluded.rush_enabled,
  rush_percent = excluded.rush_percent,
  delivery_time = excluded.delivery_time,
  description = excluded.description,
  updated_at = now();

-- Keep the first-15 offer authoritative when a signed-in customer saves an order.
-- The row lock prevents two simultaneous orders from consuming the same spot.
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
  select * into selected_service
  from public.services
  where slug = new.service_slug;

  if selected_service.slug is null then
    raise exception 'Unknown service: %', new.service_slug;
  end if;

  select * into current_settings
  from public.site_settings
  where id = 1
  for update;

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

drop trigger if exists reserve_launch_spot_before_order on public.orders;
create trigger reserve_launch_spot_before_order
before insert on public.orders
for each row execute procedure public.reserve_launch_spot();

alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.validator_checks enable row level security;
alter table public.webhook_events enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select using (true);
drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_write on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select using (true);
drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists validator_checks_select_own_or_admin on public.validator_checks;
create policy validator_checks_select_own_or_admin on public.validator_checks for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Allow the Supabase Data API roles to reach the tables; RLS still controls each row.
grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.services to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.orders to authenticated;
grant update on public.site_settings, public.services, public.orders to authenticated;
grant select on public.validator_checks to authenticated;

-- After signing up with the owner email, run this once to become admin:
-- update public.profiles set role = 'admin' where lower(email) = 'olanitealabij2023@gmail.com';
