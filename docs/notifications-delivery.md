# Notifications Delivery Layer

This document describes the queue and dispatch layer used by notifications (email, SMS, WhatsApp).

## Database objects

Run these migrations in order:

- `supabase/139_create_notifications_module.sql`
- `supabase/140_create_notification_deliveries.sql`
- `supabase/141_auto_enqueue_notification_events.sql`
- `supabase/142_task_notification_conditions_and_master_template.sql`
- `supabase/151_add_user_access_notification_events.sql`
- `supabase/152_refactor_notification_templates_runtime.sql`
- `supabase/153_seed_default_notification_templates.sql`
- `supabase/154_seed_default_notification_rules.sql`
- `supabase/155_cleanup_legacy_task_due_notifications.sql`
- `supabase/156_promote_legacy_notification_event_types.sql`
- `supabase/157_task_assignee_and_notification_recipient.sql`

Main queue table:

- `public.notification_deliveries`

Master template table:

- `public.notification_master_templates`

Template metadata:

- `notification_templates.event_type` organizes reusable templates by domain (`general`, `appointments`, `contracts`, `tasks`, `inspections`, `bugs`, `user-access`)
- `notification_templates.content_type` controls whether the template is authored as `html` or `text`
- `notification_deliveries.content_type` stores the format selected when the delivery was enqueued
- `153_seed_default_notification_templates.sql` seeds a default catalog for every existing tenant and automatically seeds future tenants on insert
- `154_seed_default_notification_rules.sql` seeds an initial ruleset for supported event types and wires future tenants to receive both templates and rules automatically

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
- `user-created` from `public.user_profiles` inserts
- `user-role-changed` from `public.user_profiles` role changes
- `user-access-approved` from `public.user_profiles` status changes to `approved`
- `user-access-rejected` from `public.user_profiles` status changes to `rejected`
- `inspection` from `public.inspections`
- `bug` from `public.bug_reports` inserts

Important behavior:

- Rules are resolved by `notification_rules.trigger` and `is_active = true`.
- Recipients are resolved from `user_profiles` by selected roles and explicit users.
- Task rules can also deliver directly to the selected task assignee when `notification_rules.send_to_task_assignee = true`.
- Only recipients with `status = 'approved'` are enqueued.
- `next_attempt_at` is calculated from event datetime minus `days_before`.
- Deliveries are deduplicated by `eventKey` + rule + channel + recipient.
- Payload for task events includes both task data and related property data (`payload.task` and `payload.property`).
- Task payload also exposes structured assignee data in `payload.task.assignee`, plus `payload.task.assigneeName`, `payload.task.assigneeType`, and `payload.task.assigneeId`.
- Payload for appointment events includes `payload.appointment`.
- Payload for contract events includes `payload.contract`.
- Payload for inspection events includes `payload.inspection`.
- Payload for bug events includes `payload.bug`.
- Payload for user access events includes `payload.user`, `payload.group`, `payload.access`, and `payload.changes`.
- Master header/footer can be configured per channel in `notification_master_templates` and are applied at dispatch time.
- Email deliveries render HTML when `content_type = 'html'`.
- SMS and WhatsApp deliveries receive a plain-text version, even when the stored template is HTML.

Useful template tokens for user access events:

- `{{user.githubLogin}}`
- `{{user.email}}`
- `{{group.role}}`
- `{{access.status}}`
- `{{changes.previousRole}}`
- `{{changes.currentRole}}`

Default seeded template catalog:

- Appointments: `appointment-items`
- Contracts: `contract-created`, `contract-expiration`, `contract-payment-day`
- Tasks: `task-created`, `task-due-tomorrow`, `task-due-today`, `task-overdue-open`, `task-resolved`
- Inspections: `inspection`
- Bugs: `bug`
- User access: `user-created`, `user-role-changed`, `user-access-approved`, `user-access-rejected`
- Channels: HTML email plus plain-text SMS and WhatsApp templates for each event
- Seeded template IDs follow the pattern `default-<channel>-<trigger>`

Default seeded rules:

- One `Appointment notifications` group with the scheduled appointment trigger
- One `Contract notifications` group with all supported contract triggers
- One `Task notifications` group with all supported task triggers
- One `Inspection notifications` group with the inspection trigger
- One `Bug report notifications` group with the bug-report trigger
- One `User access notifications` group with all supported user-access triggers
- Default channel: `email`
- Default recipients: users with role `admin`
- SMS and WhatsApp stay available in the template catalog, but are not activated by default

Useful template tokens for task assignee delivery:

- `{{task.assignee.name}}`
- `{{task.assignee.email}}`
- `{{task.assignee.phone}}`
- `{{task.assigneeType}}`
- `{{task.assigneeId}}`

Legacy cleanup:

- `155_cleanup_legacy_task_due_notifications.sql` removes the obsolete `task-due` trigger from the active ruleset
- Existing `task-due` rules are expanded into `task-due-tomorrow`, `task-due-today` and `task-overdue-open`
- `156_promote_legacy_notification_event_types.sql` promotes appointments, contracts, inspections and bugs into first-class `event_type` values

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
