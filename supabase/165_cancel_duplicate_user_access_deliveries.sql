-- Cancel duplicate pending/processing deliveries for self-service user access
-- notifications that may have been enqueued before the dedupe fixes.
--
-- This keeps the earliest delivery for each:
--   tenant + rule + channel + recipient + eventKey
-- and cancels the rest so dispatch-notifications won't send duplicate emails.

with ranked_duplicates as (
  select
    d.id,
    row_number() over (
      partition by
        d.tenant_id,
        coalesce(d.rule_id, ''),
        d.channel,
        lower(coalesce(d.recipient_destination, '')),
        coalesce(d.payload->>'eventKey', '')
      order by d.created_at asc, d.id asc
    ) as duplicate_rank
  from public.notification_deliveries d
  where d.status in ('pending', 'processing')
    and coalesce(d.payload->>'trigger', '') in ('user-access-invite', 'user-password-reset')
)
update public.notification_deliveries d
set
  status = 'cancelled',
  last_error = 'Cancelled automatically by migration 165: duplicate user access notification delivery.',
  updated_at = timezone('utc', now())
from ranked_duplicates rd
where d.id = rd.id
  and rd.duplicate_rank > 1;
