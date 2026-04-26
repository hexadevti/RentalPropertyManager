# Audit Logs

## What is this screen?

Records and displays the history of all actions performed in the system — creations, edits, deletions, logins, and logouts. Essential for traceability, compliance, and incident investigation.

## Recorded action types

| Action | When it occurs |
|---|---|
| **Login** | User logged into the system |
| **Logout** | User logged out of the system |
| **Create** | A new record was created in any module |
| **Update** | An existing record was edited |
| **Delete** | A record was removed from the system |

## Log entry information

- **Date and time** — exact timestamp of the action (UTC)
- **User** — login of who performed the action
- **Action** — type of operation performed
- **Entity** — affected module (e.g., contract, property, transaction)
- **Record ID** — identifier of the changed record

## Available filters

- **Period** — Last 24h, 7 days, 30 days, or custom range
- **Action** — filter by type (login, create, update, delete)
- **Entity** — filter by system module
- **User** — filter actions by a specific user
- **Record ID** — trace the complete history of a specific record

## Use cases

- **Investigate accidental deletion** — filter by "Delete" and the affected module
- **Audit changes in a contract** — filter by the contract ID
- **Check suspicious access** — filter by "Login" and sort by date
- **Compliance** — export action history for audit reports

## Tips

> Logs are immutable — they cannot be edited or deleted by any user, including administrators.

> Use the **Record ID** filter to see the complete history of a specific contract or property.

> The last 30 days of logs are loaded by default. For earlier periods, use the custom date filter.
