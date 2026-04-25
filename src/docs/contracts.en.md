# Contracts/Bookings

## What is this screen?

Manages rental contracts and bookings — the formal link between guest, property, and financial terms. Includes long-term monthly rentals and short-term stays, including automatic imports from platforms like Airbnb and Booking.com.

## Contract/Booking types

| Type | Use |
|---|---|
| **Monthly** | Long-term rental with recurring monthly billing |
| **Short-term** | Short-duration stay with defined check-in and check-out dates |

## Status

| Status | Meaning |
|---|---|
| **Active** | Rental in progress |
| **Expired** | Contract ended (end date in the past) |
| **Cancelled** | Terminated early by agreement or default |

## Form fields

### Guest and property
- **Guest** — select the registered tenant
- **Properties** — one or more linked properties
- **Rental type** — Monthly or Short-term

### Dates
- **Start date** — first day of the contract/booking
- **End date** — last day planned

### Financial
- **Monthly amount** — base rent
- **Payment due day** — day of the month when payment is expected
- **Special payment conditions** — discounts, grace periods, late fees, or other clauses

### Notes
Internal notes about the contract/booking (not included in generated PDFs).

## PDF generation

Select a **contract/booking template** and click **Generate PDF**. The system fills in template variables with the contract data automatically.

> To create custom templates, go to **Contract/Booking Templates**.

## Sync Platforms (iCal)

The **Sync Platforms** button fetches reservations from iCal feeds registered on properties (Airbnb, Booking.com, etc.) and automatically creates contracts/bookings:

1. Make sure iCal feeds are registered on the properties
2. Click **Sync Platforms**
3. Review the preview of found reservations
4. Select the ones to import and confirm

Already imported reservations are not duplicated (tracked by iCal event UID).

## CSV import

Use **Import CSV** to import multiple contracts/bookings at once. The system automatically matches by guest name and property name.

## Available filters

- **Status** — Active, Expired, or Cancelled
- **Search** — by guest name or property

## Tips

> A contract can link multiple properties — useful when a guest rents more than one room simultaneously.

> Contracts expiring within 30 days are highlighted in **Reports** and in the **AI Assistant** responses.

> The guest-contract link is required to create digital exit inspections.

> Reservations synced from Airbnb/Booking are created with monthly amount = 0 — edit after import to add the billed amount.
