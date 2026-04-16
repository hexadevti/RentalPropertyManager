# Planning Guide

A comprehensive property management platform designed to help property managers track rentals, finances, guests, contracts, and maintenance with user authentication via GitHub.

**Experience Qualities**: 
1. **Professional & Trustworthy** - Inspire confidence through clean design and reliable functionality
2. **Efficient & Organized** - Enable quick access to information with intuitive navigation
3. **Secure & Role-Based** - Protect sensitive data with GitHub authentication and role-based access control

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a full property management platform with multiple interconnected modules including property management, financial tracking, calendar/scheduling, document management, reporting capabilities, and user role management with GitHub authentication.

## Essential Features

### User Authentication & Role Management
- **Functionality**: GitHub OAuth authentication with automatic user profile creation. Role-based access control with two profiles: Administrator and Guest
- **Purpose**: Secure access control and personalized experience based on user roles
- **Trigger**: Automatic on app load via spark.user() API
- **Progression**: Load GitHub user → Check existing profile → Create/retrieve user profile → Assign role (owner=admin, others=guest) → Display user info in header
- **Success criteria**: User sees their GitHub avatar, username, and role badge in the header. Admins can manage user roles in Settings

### Property Registration
- **Functionality**: Add, edit, and manage properties (rooms, apartments, houses) with details like name, type, capacity, pricing
- **Purpose**: Central registry of all rental units available for management
- **Trigger**: Click "Add Property" button in Properties view
- **Functionality**: Schedule maintenance, inspections, and administrative tasks with due dates
- **Trigger**: Navigate to Tasks tab, click "Add Task"

### Document Repository
- **Purpose**: Centralize important documentation for easy access and compliance
- **Progression**: Click Upload → Select category → Add file info (name,

- **Functionality**: Generate financial summaries, occupancy rates, and revenue reports
- **Trigger**: Navigate to Reports view

## Edge Case Handling
- **Overlapping Bookings**: System prevents double-booking by checking calendar availability before con
- **Missing Data**: Form validation ensures required fields are com

The design should evoke trust, efficiency, and control—feeling like a professional business tool while remaining 
## Color Selection

- **Secondary Colors**: 
- **Functionality**: Schedule maintenance, inspections, and administrative tasks with due dates
- **Foreground/Background Pairings**: 
- **Trigger**: Navigate to Tasks tab, click "Add Task"
  - Muted (Soft Slate): Muted foreground (`oklch(0.50 0.02 250)`) - Ratio 7.1:1 ✓
## Font Selection

### Document Repository
- **Typographic Hierarchy**: 
- **Purpose**: Centralize important documentation for easy access and compliance
  - Body (Content): Inter Regular / 15px / 1.5 line heig
  - Labels: Inter Medium / 14px / 0.01em letter spacing
## Animations

- **Components**: 
- **Functionality**: Generate financial summaries, occupancy rates, and revenue reports
  - Calendar (date picker and availability grid from react-day-picker)
- **Trigger**: Navigate to Reports view
  - Input, Textarea, Select (form controls)
  - Sheet (mobile slide-out panels for forms)

## Edge Case Handling
  
  - Buttons: Solid primary with white text, outline secondary, ghost for icons; hover lifts with shadow, activ
  - Cards: Hover lifts with shadow transition, clickable cards scale slightly
- **Icon Selection**: 
  - Plus (add actions), Pencil (edit), Trash (delete), Download (export), Upload (document upload)

  - Card padding: p
  - Form spacing: gap-4 between fields

## Color Selection
  - Forms use full-width inputs with larger touch targets (min 44px)


- **Secondary Colors**: 

  - Warm Sage (`oklch(0.88 0.05 140)`) - Success states, positive cash flow

- **Foreground/Background Pairings**: 



  - Muted (Soft Slate): Muted foreground (`oklch(0.50 0.02 250)`) - Ratio 7.1:1 ✓

## Font Selection





- **Typographic Hierarchy**: 

  - H2 (Section Headers): Space Grotesk SemiBold / 24px / -0.01em letter spacing



  - Labels: Inter Medium / 14px / 0.01em letter spacing

## Animations



- **Components**: 

  - Card (property cards, transaction items, task cards)

  - Calendar (date picker and availability grid from react-day-picker)



  - Input, Textarea, Select (form controls)

  - Sheet (mobile slide-out panels for forms)
  








  - Cards: Hover lifts with shadow transition, clickable cards scale slightly

- **Icon Selection**: 

  - Plus (add actions), Pencil (edit), Trash (delete), Download (export), Upload (document upload)





  - Form spacing: gap-4 between fields





  - Forms use full-width inputs with larger touch targets (min 44px)

