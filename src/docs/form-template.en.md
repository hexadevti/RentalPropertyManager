# Contract/Booking Template Form

## Identification

- **Name** — template title (e.g., *Standard Residential Contract*, *Short-term - Summer*)
- **Type** — defines which contracts can use this template:
  - *Monthly* — long-duration contracts
  - *Short-term* — short-duration contracts with defined dates

## Text editor

Use the editor to write the complete contract. Available features:
- Bold, italic, underline
- Lists and enumerations
- Paragraph alignment
- Font size and style

## Inserting variables

Click **Help: Variables** to open the panel with available paths. Tokens must follow the `{{xpath}}` format.

### How it works

- Path structure: `table{index}.column{index}.subcolumn`
- Example: `{{owners{1}.documents{1}.number}}`
- Indexes start at `1`
- Use `{x}` to return all items in a list

### Available objects

- `contract`
- `guest`
- `properties`
- `owners`
- `template`
- `currentDate`

### Valid examples

- `{{guest.name}}`
- `{{guest.email}}`
- `{{contract.startDate}}`
- `{{properties{1}.address}}`
- `{{owners{x}.name}}`
- `{{currentDate}}`

> Do not invent variable names. Use the paths shown in the Help panel on the screen.

## Preview

Select an existing contract in the **Base contract/booking for preview** field to check how tokens are filled with real data before saving the template.

> Always test the preview before using the template in real contracts.
