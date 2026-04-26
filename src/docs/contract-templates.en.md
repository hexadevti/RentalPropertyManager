# Contract/Booking Templates

## What is this screen?

Creates and manages reusable contract templates for automatic PDF generation. Each template uses tokens in the `{{xpath}}` format, which are resolved with the real contract data at generation time.

## Template types

| Type | Use |
|---|---|
| **Monthly** | Long-term residential rental contracts |
| **Short-term** | Short-duration hospitality contracts |

## Text editor

Templates are edited in a **rich text editor** with support for:
- Bold, italic, underline
- Numbered and bulleted lists
- Text alignment
- Font size

## Template variables

Templates do not use fixed variables like `{tenant_name}`. Always use tokens in the `{{xpath}}` format.

### XPath structure

- Format: `table{index}.column{index}.subcolumn`
- Example: `{{owners{1}.documents{1}.number}}`
- Index starts at `1`
- For lists, use `{x}` to return all items

### Available root objects

- `contract`
- `guest`
- `properties`
- `owners`
- `template`
- `currentDate`

### Valid examples

- `{{guest.name}}`
- `{{guest.documents{1}.number}}`
- `{{contract.startDate}}`
- `{{contract.monthlyAmount}}`
- `{{properties{1}.name}}`
- `{{owners{1}.name}}`
- `{{owners{x}.name}}`
- `{{currentDate}}`

> Use the **Help: Variables** button to view available paths and insert the ready-made token into the editor.

## Preview

Select an existing contract in the **Base contract for preview** field to see how the template looks filled with real data before using it.

## Duplicate template

Use the **Duplicate** button to create a copy of an existing template as a starting point for a new version.

## Tips

> Create separate templates for monthly and short-term rentals, as the fields and clauses differ.

> Always test the preview before using the template in a real contract.

> The list shown in **Help: Variables** is the source of truth for available paths in the selected contract.
