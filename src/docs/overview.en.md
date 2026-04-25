# RPM - Rental Property Manager

## What is this system?

**RPM - Rental Property Manager** is a multi-tenant SaaS platform for rental property management. It centralizes control of properties, tenants, contracts/bookings, finances, tasks, documents, inspections, and automated notifications.

## Available modules

| Module | Description |
|---|---|
| **Properties** | Portfolio registration and configuration |
| **Contracts/Bookings** | Monthly and short-term rentals — includes sync with platforms (Airbnb, Booking) |
| **Guests** | Tenant, guarantor, and dependent registration |
| **Owners** | Property owner registration |
| **Finances** | Revenue and expense control |
| **Tasks** | Maintenance and activity management |
| **Appointments** | Visit and service scheduling |
| **Documents** | File and contract storage |
| **Service Providers** | Vendor and contractor registry |
| **Inspections** | Digital entry and exit checklists |
| **Reports** | Financial and operational analytics |
| **Calendar** | Consolidated view of events and due dates |
| **Templates** | Contract/booking templates for PDF generation |
| **Notifications** | Automatic alerts via email, SMS, and WhatsApp |
| **AI Assistant** | Intelligent chat for dynamic data queries |
| **Users** | Permission management and access control |
| **Audit Logs** | System action tracking |

## Bulk import via CSV

All registration modules support CSV import. Use the **Import CSV** button in each screen:

| Module | Generated template |
|---|---|
| Properties | `template-propriedades.csv` |
| Guests | `template-hospedes.csv` |
| Owners | `template-proprietarios.csv` |
| Contracts/Bookings | `template-contratos.csv` |
| Finances (transactions) | `template-transacoes.csv` |
| Service Providers | `template-prestadores.csv` |

## Booking platform integration

Properties support iCal feeds from external platforms (Airbnb, Booking.com, VRBO):
- Register feeds in the **iCal Calendars** section of each property
- Use **Sync Platforms** in Contracts/Bookings to automatically import reservations
- Each property generates a public iCal link to export registered bookings

## Automatic notifications

Configure rules in **Notifications** to receive alerts via:
- **Email** — via Resend
- **WhatsApp** — via Twilio (requires phone number in user profile)
- **SMS** — via configurable webhook

## Typical workflow

1. **Register properties** — define type, price, capacity, and rooms
2. **Register owners and guests** — personal data and documentation
3. **Create contracts/bookings** — link guest, property, dates, and values
4. **Record financial transactions** — revenues and expenses linked to contracts
5. **Perform inspections** — entry and exit checklists per tenant
6. **Track tasks and appointments** — maintenance, visits, and commitments
7. **Generate reports** — financial and operational portfolio analysis

## Access profiles

- **Admin** — full tenant access
- **Regular user** — restricted access as configured by admin
- **Platform admin** — views and manages all tenants

## General tips

> Use search filters in each screen to quickly find records.

> All data is automatically saved to the cloud after each operation.

> The AI Assistant queries the database dynamically — ask specific questions for best results.
