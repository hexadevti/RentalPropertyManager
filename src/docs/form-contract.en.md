# Contract/Booking Form

## Guest and property

- **Guest** — select the registered tenant. If they don't exist yet, register them first in Guests or use the **New Guest** button within this form.
- **Properties** — select one or more linked properties (useful for guests renting multiple rooms).
- **Rental type** — Monthly (long-term) or Short-term (daily rates with defined checkout date).

## Dates

- **Start date** — first day of the contract/booking
- **End date** — last day planned; required for short-term rentals

## Financial

- **Monthly amount** — base rent
- **Payment due day** — day of the month when payment is expected (e.g., day 5 → due every 5th)
- **Special payment conditions** — extra clauses: grace period, late fee, punctuality discount, etc.

## Notes

Internal notes about the contract/booking. Not included in generated PDFs.

## Contract/Booking Template

Select a template to enable PDF generation with automatically filled variables.

> Create or edit templates in **Contract/Booking Templates** before using this option.

## PDF generation

After saving, use the **Generate PDF** button on the contract card:
- Select the template and language
- Use **Preview** to open in the browser
- Use **Download PDF** to save the file

## Contracts/bookings created via iCal sync

When imported via platform synchronization, contracts/bookings are created with:
- Type: **Short-term**
- Monthly amount: **0** (edit after import)
- Guest: automatically created with the platform name
- Notes: source platform feed name
