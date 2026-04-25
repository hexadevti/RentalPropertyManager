# Digital Inspections

## What is this screen?

Manages the property inspection process with a digital room-by-room checklist. Records the condition of each item at tenant entry and exit, allowing comparison and damage identification.

## Inspection status flow

```
Draft → In Progress → Evaluated
```

| Status | What is possible |
|---|---|
| **Draft** | Edit structure: item names, rooms, and sections |
| **In Progress** | Evaluate conditions for each item; structure is locked |
| **Evaluated** | Inspection complete; PDF generation enabled |

## Inspection types

| Type | When to use |
|---|---|
| **Entry** | At contract start, when handing property to tenant |
| **Exit** | At contract end, when receiving property back |
| **Maintenance** | During rental, after repair or renovation work |
| **Periodic** | Routine review during rental |

> **Rule:** To create an Exit, Maintenance, or Periodic inspection, the Entry inspection for the same contract must be "In Progress" or "Evaluated."

## Item conditions

| Condition | Meaning |
|---|---|
| **Excellent** | Perfect condition, no wear |
| **Good** | Adequate condition, minimal natural wear |
| **Attention** | Requires monitoring or minor adjustment |
| **Damaged** | Requires repair or replacement |
| **N/A** | Not applicable or not checked |

## Checklist structure

- **Rooms** (houses/apartments) — Living room, Bedroom 1, Bathroom, etc.
- **Sections** (rooms) — Furniture, Inspection items

Rooms and items are defined in the **Property** registration.

## Draft mode (structure)

In draft mode you can:
- Rename rooms and items
- Add or remove rooms and items
- Conditions cannot be evaluated

## In Progress mode (evaluation)

Once the inspection starts:
- Structure is locked (items cannot be added/removed)
- Select the condition for each item
- Add notes per item and per room

## Return to Draft

You can return to draft from "In Progress" status. **Warning:** all conditions and notes will be erased.

## Linked inspections

Exit, Maintenance, and Periodic inspections are automatically linked to the Entry inspection of the same contract. The system shows **differences** between each inspection and the previous one:

- Items that worsened in condition are highlighted
- The **Create task** button automatically generates a maintenance task for damaged items

## PDF generation

Available only when the inspection is in **Evaluated** status. The PDF includes:
- Property, contract, and inspector data
- Complete checklist with conditions and notes
- Date and signature

## Tips

> Perform the entry inspection before handing over the keys — it serves as proof of the property's initial condition.

> Use detailed notes on "Damaged" items to support security deposit deductions.

> Periodic inspections allow monitoring the property's condition during the rental without requiring contract termination.
