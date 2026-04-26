# Properties

## What is this screen?

Manages the portfolio of properties available for rent. Each property is the base unit of the system — contracts/bookings, inspections, finances, and tasks are always linked to a property.

## Property types

| Type | Description |
|---|---|
| **Room** | Individual unit within a shared house or apartment |
| **Apartment** | Autonomous unit in a building |
| **House** | Complete residential property |
| **Parking** | Standalone parking spot or garage |

## Registering a property

### Basic information
- **Name** — internal property identifier (e.g., "Apt 203 - Downtown")
- **Type** — defines the inspection checklist structure
- **Capacity** — maximum number of occupants
- **Conservation state** — Excellent, Good, Fair, or Poor

### Pricing
- **Price per night** — for short-term (seasonal) rentals
- **Price per month** — for long-term (monthly) rentals

### Location
- **City** and **Address** — used in contracts/bookings, reports, and the map view

### Inspection items and furniture
- **Inspection items** — points to check at entry/exit (e.g., "Faucet", "Window", "Outlet")
- **Furniture** — items present in the property (e.g., "Bed", "Wardrobe", "Refrigerator")
- **Rooms** — property rooms (e.g., "Living room", "Bedroom 1", "Bathroom") — only for apartments and houses

> Rooms and items defined here form the automatic checklist for digital inspections.

### Linked owners
Associate one or more property owners for transfer control and owner-based reports.

### Photos
Upload property photos (up to 10 MB per file). Set the **cover photo** that appears on the property card. Drag to reorder. Supports paste (Ctrl+V) and drag-and-drop.

## iCal Calendars

The **iCal Calendars** section on each property supports two types of integration:

### Export link (our system → platforms)
Each property generates a public iCal link with all registered bookings. Copy the link and paste it into Airbnb, Booking.com, or any calendar app to sync availability.

### External feeds (platforms → our system)
Add iCal links from external booking platforms (Airbnb, Booking.com, VRBO, Expedia):
1. Click **Add feed**
2. Select the platform
3. Paste the iCal URL from the platform
4. Save the property

Registered feeds are used by the **Sync Platforms** button in Contracts/Bookings.

## CSV import

Use the **Import CSV** button to import multiple properties at once. Download the template, fill it in, and import.

## Map view

The **Map** button displays properties on a map (requires registered address). Click **Show on map** on a card to focus a specific property.

## Available actions

- **Edit** — update property data
- **Generate Contract/Booking** — opens a pre-filled form for this property
- **Copy iCal link** — copies the property export link
- **Duplicate** — creates a copy of the property with the same data
- **Delete** — removes the property

## Tips

> Fill in rooms correctly — they define the inspection checklist structure.

> To sync with Airbnb/Booking.com, register the platform's iCal feed and use **Sync Platforms** in Contracts/Bookings.

> You can link the same property to multiple owners for co-ownership scenarios.
