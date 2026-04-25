# AI Assistant

## What is this screen?

Intelligent chat powered by **Claude** (Anthropic) that answers questions about your portfolio data in natural language. The assistant queries the database dynamically to provide accurate and up-to-date answers.

## How to use

1. Type your question in the text box
2. Press **Enter** to send — or **Ctrl+Enter** for a line break
3. The assistant queries the necessary data and responds in a few seconds

## What the assistant can answer

- Current month's financial balance and by category
- Available and occupied properties
- Active, expiring, or recently closed contracts/bookings
- Pending tasks by property or priority
- Upcoming appointments
- Service providers by specialty
- Registered documents by type
- Completed and pending inspections

## How the assistant works

The assistant uses **tool use** — it decides which tables to query for each question, executes the queries, and cross-references the results. There is no pre-loaded record limit: it fetches only what is necessary to answer.

## Available models

| Model | Best for |
|---|---|
| **Claude Sonnet 4.6** | General use — best cost/quality balance *(default)* |
| **Claude Haiku 4.5** | Simple, quick questions — most economical |
| **Claude Opus 4.7** | Complex analyses — maximum capability |

## Queries performed panel

The side panel shows how many query iterations were needed for the last question. Questions that require cross-referencing multiple tables result in more iterations.

## Quick questions

Use the **Quick questions** buttons in the side panel for common queries with a single click.

## Conversation persistence

The history is maintained while you navigate the system. Use the **Clear conversation** button to restart.

## Best practices

> Be specific: "What is March 2026's balance?" works better than "How are the finances?".

> The assistant responds based on registered data — records not created in the system will not appear.

> For actions that change data (create a contract, record a payment), use the corresponding modules — the assistant is advisory only.

## Availability and security

- Available only for **approved administrators**
- All queries are filtered by the user's tenant — no access to other tenants' data
- Usage is logged with token consumption for cost control
