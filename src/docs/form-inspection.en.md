# Inspection Form

## Step 1 — Configuration

### Property and contract

- **Property** — property to be inspected
- **Contract/Booking** — linked rental contract (required to create exit/maintenance inspections)

> When selecting a contract, the system automatically checks which inspection types are allowed.

### Inspection type

| Type | When to create |
|---|---|
| **Entry** | Before handing the property to the tenant |
| **Exit** | When receiving the property back at contract end |
| **Maintenance** | After repair or renovation work |
| **Periodic** | Routine review during the rental |

> Exit, Maintenance, and Periodic can only be created when the Entry inspection for the contract is "In Progress" or "Evaluated."

### Other fields

- **Inspector** — name of the person conducting the inspection
- **Inspection date** — scheduled or completed date
- **Title** *(optional)* — auto-generated if left blank
- **Summary** *(optional)* — general notes about the property condition

## Step 2 — Checklist

The checklist is automatically generated based on the rooms and items registered in the Property.

### Draft mode
- Rename rooms and items as needed
- Add or remove items
- Conditions cannot be evaluated yet

### In Progress mode
Once the inspection starts, the structure is locked and you evaluate each item:

| Condition | Meaning |
|---|---|
| **Excellent** | Perfect condition |
| **Good** | Minimal natural wear |
| **Attention** | Requires monitoring |
| **Damaged** | Requires repair or replacement |
| **N/A** | Not applicable / not checked |

Add specific notes for each item and at the end of each room.
