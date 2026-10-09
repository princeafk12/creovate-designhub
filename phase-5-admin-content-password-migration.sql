-- Run this once in the Supabase SQL Editor after schema.sql.
-- It adds the owner-editable public content store to existing projects.
alter table public.site_settings
  add column if not exists content jsonb not null default '{}'::jsonb;

update public.site_settings
set content = coalesce(content, '{}'::jsonb),
    updated_at = now()
where id = 1;

-- The existing settings_admin_write policy and grant already cover this column.
-- The password reset route uses SUPABASE_SERVICE_ROLE_KEY on the server only;
-- never place that key in the browser or in this file.
