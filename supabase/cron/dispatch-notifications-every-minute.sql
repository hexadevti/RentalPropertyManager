create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recreate the job safely when re-running this script.
select cron.unschedule('dispatch-notifications-every-minute')
where exists (
  select 1
  from cron.job
  where jobname = 'dispatch-notifications-every-minute'
);

select cron.schedule(
  'dispatch-notifications-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://waxzvfpuqrkawnrzkwca.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- Required when Edge Function has JWT verification enabled.
      'Authorization', 'Bearer <SUPABASE_ANON_OR_SERVICE_ROLE_KEY>',
      -- Keep this header only if NOTIFICATION_DISPATCH_SECRET is configured in the function.
      'x-dispatch-secret', '<NOTIFICATION_DISPATCH_SECRET>'
    ),
    body := '{"limit":25}'::jsonb
  );
  $$
);