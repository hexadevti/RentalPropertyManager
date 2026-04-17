-- Optional script: seeds initial values for app-level settings.

insert into public.app_kv (key, value)
values
  ('app-language', '"pt"'::jsonb),
  ('app-currency', '"BRL"'::jsonb)
on conflict (key)
do nothing;
