# Planning Guide

A comprehensive property rental management system for short-term and long-term rentals, providing property managers with tools to track availability, finances, tasks, and operations.

**Experience Qualities**: 
1. **Efficient** - Streamlined workflows that minimize clicks and maximize productivity for busy property managers
2. **Organized** - Clear visual hierarchy and intuitive navigation across multiple management areas
3. **Professional** - Polished interface that inspires confidence in managing significant financial operations

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a full property management platform with multiple interconnected modules including property management, financial tracking, calendar/scheduling, document management, and reporting capabilities.

## Essential Features

### Property Registration
- **Functionality**: Add, edit, and manage properties (rooms, apartments, houses) with details like name, type, capacity, pricing
- **Purpose**: Central registry of all rental units available for management
- **Trigger**: Click "Add Property" button in Properties view
- **Progression**: Click Add Property → Fill form (name, type, capacity, rates) → Save → Property appears in list
- **Success criteria**: Properties persist in storage and display in property list with all details

### Financial Management
- **Functionality**: Track income (bookings), expenses, and service providers with categorization
- **Purpose**: Maintain accurate financial records and monitor cash flow
- **Trigger**: Navigate to Finances tab, click "Add Transaction"
- **Progression**: Select Finances → Choose transaction type → Fill details (amount, date, category, description) → Save → Updates balance
- **Success criteria**: Transactions are recorded, balance calculates correctly, and cash flow is visible

### Availability Calendar
- **Functionality**: Visual calendar showing property availability and bookings with color-coded status
- **Purpose**: Prevent double-bookings and optimize occupancy rates
- **Trigger**: Navigate to Calendar view
- **Progression**: Open Calendar → View property availability → Click date → Create/view booking → Status updates
- **Success criteria**: Calendar displays accurate availability, bookings are color-coded, no conflicts allowed

### Task & Appointment Management
- **Functionality**: Schedule maintenance, inspections, and administrative tasks with due dates
- **Purpose**: Organize property management activities and service provider coordination
- **Trigger**: Navigate to Tasks tab, click "Add Task"
- **Progression**: Click Add Task → Enter details (title, date, assignee, priority) → Save → Appears in task list
- **Success criteria**: Tasks are created, sorted by date/priority, and can be marked complete

### Document Repository
- **Functionality**: Store and organize contracts, receipts, insurance documents, and records
- **Purpose**: Centralize important documentation for easy access and compliance
- **Trigger**: Navigate to Documents tab, click "Upload"
- **Progression**: Click Upload → Select category → Add file info (name, type, notes) → Save → Document listed
- **Success criteria**: Documents are categorized, searchable, and persist in storage

### Reports Dashboard
- **Functionality**: Generate financial summaries, occupancy rates, and revenue reports
- **Purpose**: Provide insights for business decisions and performance tracking
- **Trigger**: Navigate to Reports view
- **Progression**: Open Reports → Select date range → View metrics (revenue, occupancy, expenses) → Export data
- **Success criteria**: Reports display accurate aggregated data from bookings and transactions

## Edge Case Handling
- **Empty States**: Friendly prompts guide users to add their first property, booking, or transaction
- **Overlapping Bookings**: System prevents double-booking by checking calendar availability before confirming
- **Invalid Dates**: Past dates blocked for new bookings, validation on date ranges
- **Missing Data**: Form validation ensures required fields are completed before saving
- **Deleted Properties**: Bookings for deleted properties are archived but not removed from historical data

## Design Direction
The design should evoke trust, efficiency, and control—feeling like a professional business tool while remaining approachable and easy to navigate. It should communicate organization through clear sections, confident typography, and a color scheme that balances energy with stability.

## Color Selection
A vibrant yet professional palette that conveys energy, growth, and financial stability.

- **Primary Color**: Deep Ocean Blue (`oklch(0.45 0.15 250)`) - Represents trust, professionalism, and stability for financial operations
- **Secondary Colors**: 
  - Soft Slate (`oklch(0.95 0.01 250)`) - Neutral background for cards and sections
  - Warm Sage (`oklch(0.88 0.05 140)`) - Success states, positive cash flow
- **Accent Color**: Vibrant Coral (`oklch(0.68 0.19 25)`) - Energetic highlight for CTAs, important actions, and status indicators
- **Foreground/Background Pairings**: 
  - Background (Light Cream `oklch(0.98 0.01 85)`): Primary text (`oklch(0.25 0.02 250)`) - Ratio 12.8:1 ✓
  - Primary (Deep Ocean Blue): White text (`oklch(1 0 0)`) - Ratio 8.2:1 ✓
  - Accent (Vibrant Coral): White text (`oklch(1 0 0)`) - Ratio 4.6:1 ✓
  - Muted (Soft Slate): Muted foreground (`oklch(0.50 0.02 250)`) - Ratio 7.1:1 ✓

## Font Selection
Typography should convey modern professionalism with excellent readability for data-heavy interfaces and financial information.

- **Primary Font**: Space Grotesk for headings - Geometric, modern, distinctive character
- **Secondary Font**: Inter for body text - Clean, highly legible, optimized for UI

- **Typographic Hierarchy**: 
  - H1 (Page Titles): Space Grotesk Bold / 32px / -0.02em letter spacing
  - H2 (Section Headers): Space Grotesk SemiBold / 24px / -0.01em letter spacing
  - H3 (Card Headers): Space Grotesk Medium / 18px / normal letter spacing
  - Body (Content): Inter Regular / 15px / 1.5 line height
  - Small (Meta info): Inter Regular / 13px / 1.4 line height
  - Labels: Inter Medium / 14px / 0.01em letter spacing

## Animations
Animations should feel purposeful and efficient, reinforcing actions without slowing down the workflow. Use subtle transitions for state changes (200ms ease), smooth page navigation (300ms), and micro-interactions on hover (150ms) to provide feedback. Key moments like successful transaction saves or booking confirmations deserve a brief celebratory animation (400ms with slight bounce).

## Component Selection
- **Components**: 
  - Tabs (navigation between Properties/Finances/Calendar/Tasks/Documents/Reports)
  - Card (property cards, transaction items, task cards)
  - Dialog (add/edit forms for properties, transactions, tasks)
  - Calendar (date picker and availability grid from react-day-picker)
  - Table (transaction lists, property lists, reports)
  - Badge (property status, task priority, booking state)
  - Button (primary actions, secondary actions, icon buttons)
  - Input, Textarea, Select (form controls)
  - Avatar (service provider identification)
  - Sheet (mobile slide-out panels for forms)
  
- **Customizations**: 
  - Custom calendar grid component for availability visualization
  - Custom stat cards for dashboard metrics with icons
  - Custom transaction timeline component
  
- **States**: 
  - Buttons: Solid primary with white text, outline secondary, ghost for icons; hover lifts with shadow, active scales down slightly
  - Inputs: Subtle border, focus ring in primary color, error state in destructive red
  - Cards: Hover lifts with shadow transition, clickable cards scale slightly
  
- **Icon Selection**: 
  - House (properties), Wallet (finances), Calendar (bookings), CheckSquare (tasks), FileText (documents), ChartBar (reports)
  - Plus (add actions), Pencil (edit), Trash (delete), Download (export), Upload (document upload)
  
- **Spacing**: 
  - Page padding: p-6 (24px) on desktop, p-4 (16px) mobile
  - Card padding: p-6 for large cards, p-4 for compact
  - Section gaps: gap-6 for main layout, gap-4 for card grids
  - Form spacing: gap-4 between fields
  
- **Mobile**: 
  - Tabs convert to bottom sheet navigation on mobile
  - Tables become card lists with key information prioritized
  - Multi-column layouts stack to single column
  - Forms use full-width inputs with larger touch targets (min 44px)
  - Calendar switches to compact week view on small screens
