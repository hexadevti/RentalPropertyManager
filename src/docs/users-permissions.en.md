# Users & Permissions

## What is this screen?

Administrative panel for user management, access profile control, invitation sending, and system activity monitoring.

## Access profiles

Each user's access is controlled by configurable **access profiles**. Each profile defines, module by module, the permission level:

| Level | What the user can do |
|---|---|
| **None** | Module does not appear in the menu |
| **Read** | Can view, but cannot create/edit/delete |
| **Write** | Full access to the module |

Users with the **Admin** role have full access by default.

## User status

| Status | Meaning |
|---|---|
| **Approved** | Access granted to the system |
| **Pending** | Registration awaiting approval |
| **Blocked** | Access suspended by admin |

## Editing a user

Click **Edit** on the user card to change:
- **Login** — identification name
- **Email** — email address
- **Phone (WhatsApp)** — number in international format (e.g., `+15551234567`). Required to receive WhatsApp notifications.
- **Avatar** — profile picture URL
- **Access profile** — defines module permissions
- **Status** — Approved, Pending, or Blocked

> The phone must be in E.164 format: `+` followed by country code and number, no spaces or dashes.

## Inviting users

Use the **Invite** button to send an email invitation. The user receives a link to create their account directly in the tenant, without needing to request access manually.

## Active session monitoring

The **Online users** panel shows in real time:
- Users with an active session
- Current screen, IP, browser, and last activity

## AI Assistant usage

The panel shows per user: number of queries, tokens consumed, and estimated cost in USD.

## Tenant management

The admin can edit the tenant name in this screen.

## WhatsApp configuration (Twilio)

For WhatsApp notifications to work:
1. The tenant must have `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` configured in Supabase secrets
2. Each recipient user must have a **phone number** registered in their profile (international format)
3. Configure a notification rule with the **WhatsApp** channel in the Notifications screen

## Tips

> Review pending users regularly — new registrations wait for manual approval.

> Register the phone number of all users who should receive WhatsApp alerts.

> Use access profiles to grant partial access to collaborators (e.g., read-only for finances and contracts).
