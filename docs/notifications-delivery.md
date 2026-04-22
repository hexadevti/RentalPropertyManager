# Notifications Delivery Layer

This document describes the queue and dispatch layer used by notifications (email, SMS, WhatsApp).

## Database objects

Run these migrations in order:

- `supabase/139_create_notifications_module.sql`
- `supabase/140_create_notification_deliveries.sql`
- `supabase/141_auto_enqueue_notification_events.sql`
- `supabase/142_task_notification_conditions_and_master_template.sql`

Main queue table:

- `public.notification_deliveries`

Master template table:

- `public.notification_master_templates`

Key statuses:

- `pending`
- `processing`
- `sent`
- `failed`
- `cancelled`

## Edge function

Function name:

- `dispatch-notifications`

File:

- `supabase/functions/dispatch-notifications/index.ts`

Config:

- `supabase/config.toml` -> `[functions.dispatch-notifications] verify_jwt = false`

## Required environment variables

Supabase runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional protection for function calls:

- `NOTIFICATION_DISPATCH_SECRET`

Optional forced destination for testing/sandbox:

- `NOTIFICATION_FORCE_EMAIL_TO` (if set, all channels are sent as email to this address)

Email provider (Resend):

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

SMS webhook provider:

- `SMS_WEBHOOK_URL`
- `SMS_WEBHOOK_TOKEN` (optional)

WhatsApp webhook provider:

- `WHATSAPP_WEBHOOK_URL`
- `WHATSAPP_WEBHOOK_TOKEN` (optional)

## Dispatch API

Method:

- `POST`

Body (all optional):

```json
{
  "limit": 25,
  "tenantId": "<tenant-uuid>",
  "dryRun": false
}
```

Headers:

- `Content-Type: application/json`
- `x-dispatch-secret: <NOTIFICATION_DISPATCH_SECRET>` (required only if secret is configured)

Response:

```json
{
  "processed": 10,
  "sent": 7,
  "failed": 1,
  "retried": 2,
  "skipped": 0,
  "dryRun": false
}
```

## Retry behavior

- Each attempt increments `attempts`.
- When dispatch fails:
  - If `attempts >= max_attempts`, status becomes `failed`.
  - Otherwise status returns to `pending` with exponential backoff in `next_attempt_at`.

## Automatic enqueue from business events

Migration `141_auto_enqueue_notification_events.sql` adds trigger-based enqueue for:

- `appointment-items` from `public.appointments` (scheduled appointments)
- `contract-created` from `public.contracts` inserts
- `contract-expiration` from active contracts (`end_date`)
- `contract-payment-day` from active contracts (`payment_due_day`)
- `task-created` from `public.tasks` inserts
- `task-due-tomorrow` from `public.tasks` (`due_date = tomorrow`)
- `task-due-today` from `public.tasks` (`due_date = today`)
- `task-overdue-open` from `public.tasks` (`due_date < today` and not completed)
- `task-due` from `public.tasks` (legacy compatibility)
- `inspection` from `public.inspections`
- `bug` from `public.bug_reports` inserts

Important behavior:

- Rules are resolved by `notification_rules.trigger` and `is_active = true`.
- Recipients are resolved from `user_profiles` by selected roles and explicit users.
- Only recipients with `status = 'approved'` are enqueued.
- `next_attempt_at` is calculated from event datetime minus `days_before`.
- Deliveries are deduplicated by `eventKey` + rule + channel + recipient.
- Payload for task events includes both task data and related property data (`payload.task` and `payload.property`).
- Master header/footer can be configured per channel in `notification_master_templates` and are applied at dispatch time.

## Suggested execution model

1. Let DB triggers enqueue rows into `notification_deliveries` automatically.
2. Trigger `dispatch-notifications` on a schedule (e.g., every minute).
3. Monitor stats via `public.notification_delivery_stats`.

## Optional manual queue insert example

```sql
insert into public.notification_deliveries (
  tenant_id,
  rule_id,
  template_id,
  channel,
  recipient_user_id,
  recipient_login,
  recipient_destination,
  subject,
  message_body,
  payload
)
values (
  '<tenant-id>',
  '<rule-id>',
  '<template-id>',
  'email',
  '<auth-user-id>',
  'john.doe',
  'john@example.com',
  'Contract payment reminder',
  '<p>Your contract payment is due soon.</p>',
  '{"trigger":"contract-payment-day"}'::jsonb
);
```
