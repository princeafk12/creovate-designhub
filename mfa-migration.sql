-- Run this once in the Supabase SQL Editor for an existing project.
-- It makes the admin role require a verified second factor (AAL2), and
-- keeps the first-15 price/spot calculation authoritative in the database.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = uid and role = 'admin'
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
  new.rush := coalesce(new.rush, false);
  return new;
end;
$$;

drop trigger if exists reserve_launch_spot_before_order on public.orders;
create trigger reserve_launch_spot_before_order
before insert on public.orders
for each row execute procedure public.reserve_launch_spot();

grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.services to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, select on public.orders to authenticated;
grant update on public.site_settings, public.services, public.orders to authenticated;
