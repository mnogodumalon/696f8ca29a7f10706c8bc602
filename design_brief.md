# Design Brief: Werkzeugmanagement

## 1. App Analysis

### What This App Does
This is a **tool management system** (Werkzeugmanagement) for an electrical/technical services company. It tracks tools (Werkzeuge), assigns them to employees (Mitarbeiter) for specific projects (Projekte), and manages maintenance schedules (Wartung). The central entity is the tool inventory, with everything else revolving around keeping tools accounted for, maintained, and properly assigned.

### Who Uses This
A **workshop manager or team lead** at an electrical installation/maintenance company. They manage a fleet of tools across multiple departments (Wartung und Service, Planung, Elektroinstallation, Verwaltung, Lager). They need to know at a glance: which tools are where, which need maintenance, and which are currently assigned. They are not technical users - they think in terms of "who has what" and "what needs fixing."

### The ONE Thing Users Care About Most
**"How many tools need attention right now?"** - This means tools that are overdue for maintenance, in poor condition (reparaturbeduerftig/defekt), or overdue for return. The user opens this dashboard to see what needs their action TODAY.

### Primary Actions (IMPORTANT!)
1. **Werkzeug zuweisen** (Assign Tool) - This is the #1 action. The core workflow is assigning tools to employees for projects. This becomes the Primary Action Button.
2. Wartung erfassen (Log Maintenance) - After inspections/repairs, users log what was done.
3. Neues Werkzeug anlegen (Add new tool to inventory)

---

## 2. What Makes This Design Distinctive

### Visual Identity
The design uses a **cool steel-blue palette with warm amber accents**, evoking a professional workshop environment. The steel-blue base feels technical and trustworthy, while the amber accent draws attention to action items like warnings and primary buttons - the same way a safety marker highlights important things in a real workshop. The overall feel is "organized toolbox" - everything has its place.

### Layout Strategy
The layout is **asymmetric on desktop** with a dominant left column (2/3 width) showing the hero attention counter and the main tool list, and a narrower right column (1/3 width) showing upcoming maintenance and recent assignments. This mirrors the user's mental model: "What needs my attention?" (left, big) vs "What's happening?" (right, supporting context).

On mobile, the hero takes the full top fold with a bold attention counter, followed by a horizontal scrolling row of secondary KPIs, then stacked content sections.

### Unique Element
The **hero "Attention Required" counter** uses an oversized 64px bold number with a pulsing amber dot indicator when there are items needing action. Below it, three compact sub-indicators show the breakdown (overdue maintenance, defective tools, overdue returns) as inline colored badges - not cards, but tight inline text with colored dots. This creates a "control panel" feel that's distinct from typical dashboard KPI cards.

---

## 3. Theme & Colors

### Font
- **Family:** Space Grotesk
- **URL:** `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap`
- **Why this font:** Space Grotesk has a technical, engineered quality with geometric forms that fit a tool management context. Its distinct character at headings (slightly squared counters) gives personality without sacrificing readability at small sizes.

### Color Palette
All colors as complete hsl() functions:

| Purpose | Color | CSS Variable |
|---------|-------|--------------|
| Page background | `hsl(210 20% 98%)` | `--background` |
| Main text | `hsl(215 25% 15%)` | `--foreground` |
| Card background | `hsl(0 0% 100%)` | `--card` |
| Card text | `hsl(215 25% 15%)` | `--card-foreground` |
| Borders | `hsl(210 15% 90%)` | `--border` |
| Primary action (amber) | `hsl(35 92% 50%)` | `--primary` |
| Text on primary | `hsl(0 0% 100%)` | `--primary-foreground` |
| Accent (steel-blue) | `hsl(210 45% 94%)` | `--accent` |
| Muted background | `hsl(210 15% 96%)` | `--muted` |
| Muted text | `hsl(215 15% 50%)` | `--muted-foreground` |
| Success/positive | `hsl(152 55% 42%)` | (component use) |
| Warning | `hsl(35 92% 50%)` | (component use) |
| Error/negative | `hsl(0 72% 51%)` | `--destructive` |

### Why These Colors
The cool gray-blue base (`hsl(210 20% 98%)`) creates a calm, professional workshop atmosphere. The amber primary (`hsl(35 92% 50%)`) is deliberately chosen because amber/yellow is universally associated with caution and attention in industrial contexts - perfect for a tool management system where the primary action is about managing assignments and maintenance alerts. The steel-blue accent is used for informational highlighting without competing with the amber call-to-action.

### Background Treatment
The page background uses a very subtle cool-tinted off-white (`hsl(210 20% 98%)`). Cards sit on pure white to create gentle elevation distinction. No gradients or textures - the depth comes from the white-on-cool-gray card separation and subtle shadows.

---

## 4. Mobile Layout (Phone)

### Layout Approach
The mobile layout is a focused vertical flow where the hero dominates the first viewport. The attention counter is the visual anchor - large, bold, impossible to miss. Below it, secondary KPIs use a compact horizontal scroll row (not cards, but inline pill-style badges) to save vertical space. Content sections stack vertically with clear section headers.

### What Users See (Top to Bottom)

**Header:**
- Left: "Werkzeuge" title in 20px/600 weight Space Grotesk
- Right: A gear/settings icon (muted) for future use, and the primary action button "Zuweisen" (compact, amber, pill-shaped)

**Hero Section (The FIRST thing users see):**
- Takes approximately 40% of the initial viewport
- Background: white card with 16px border-radius, subtle shadow
- Top line: "Handlungsbedarf" label in 13px/500 muted-foreground, uppercase letter-spacing 0.05em
- Center: The attention count as a **64px/700 weight** number in foreground color
- Below number: "Werkzeuge brauchen Aufmerksamkeit" in 14px/400 muted-foreground
- Bottom row: Three inline indicators separated by subtle vertical dividers:
  - Amber dot + "3 Wartung fällig" (14px)
  - Red dot + "2 Defekt" (14px)
  - Blue dot + "1 Rückgabe überfällig" (14px)
- The amber dot pulses with a subtle CSS animation when count > 0
- **Why this is the hero:** The workshop manager opens the app to see "do I need to do something?" This answers that instantly.

**Section 2: Quick Stats Row (horizontal scroll)**
- Horizontally scrollable row of 4 compact stat pills (not cards):
  - "Gesamt: 47" (total tools)
  - "Zugewiesen: 12" (currently assigned)
  - "Verfügbar: 31" (available)
  - "In Wartung: 4" (in maintenance)
- Each pill: rounded background in muted color, 13px text, 8px/16px padding
- Scrollable on mobile, static row on wider screens

**Section 3: Werkzeuge (Tool List)**
- Section header: "Werkzeuge" (16px/600) with a "+" button on the right to add new tool
- Compact list items showing:
  - Tool name (15px/500)
  - Below: Category badge (small, muted bg) + Zustand badge (color-coded: green for gut/neu, amber for befriedigend, red for defekt/reparaturbeduerftig)
  - Right side: Chevron icon indicating tappable
- Sorted by zustand priority (defekt first, then reparaturbeduerftig, etc.)
- Shows first 10, with "Alle anzeigen" link at bottom
- Tapping opens detail view (sheet from bottom)

**Section 4: Nächste Wartungen (Upcoming Maintenance)**
- Section header: "Nächste Wartungen" (16px/600) with "+" button to log maintenance
- List of upcoming/overdue maintenance items:
  - Tool name (from werkzeug applookup)
  - Wartungstyp badge
  - Date (formatted as "dd.MM.yyyy")
  - Overdue items highlighted with red text and red left border
- Sorted by naechste_wartung date (overdue first, then soonest)
- Shows first 5 items

**Section 5: Aktive Zuweisungen (Active Assignments)**
- Section header: "Aktive Zuweisungen" (16px/600)
- Cards showing:
  - Mitarbeiter name
  - Werkzeug name
  - Projekt name (if assigned)
  - Geplante Rückgabe date
  - Overdue returns highlighted in red
- Shows assignments where tatsaechliche_rueckgabe is null (still active)

**Bottom Navigation / Action:**
- Fixed bottom bar with the primary action: "Werkzeug zuweisen" button (full-width amber, 48px height, pill-shaped)

### Mobile-Specific Adaptations
- Hero section uses full width with generous padding (24px)
- Stats row is horizontally scrollable with snap points
- Tool list items are taller with larger touch targets (minimum 56px height)
- Section headers are sticky when scrolling
- All tables become card lists on mobile

### Touch Targets
- All list items: minimum 56px height
- Buttons: minimum 44px height
- The primary action button: 48px height, full-width
- Adequate padding between interactive elements (minimum 8px)

### Interactive Elements
- Tool list items: tap to open bottom sheet with full tool details + edit/delete actions
- Maintenance items: tap to open detail dialog
- Assignment items: tap to open detail dialog
- All lists: pull to refresh

---

## 5. Desktop Layout

### Overall Structure
Two-column asymmetric layout: **2fr + 1fr** (approximately 66% / 34%).

The eye flows:
1. **First:** Hero attention counter (top-left, large)
2. **Second:** Quick stats row (below hero, inline)
3. **Third:** Tool inventory table (main content area, left column)
4. **Fourth:** Upcoming maintenance (right column, top)
5. **Fifth:** Active assignments (right column, bottom)

Maximum content width: 1400px, centered with auto margins. Padding: 32px on sides.

### Section Layout

**Top area (full width):**
- Header row: "Werkzeugmanagement" title (28px/700) on left, primary action button "Werkzeug zuweisen" on right (amber, medium size)
- Below: Hero attention counter (left-aligned, not full width - takes about 50% of the row)
- Next to hero: Quick stats as 4 inline items in a row (no cards, just number + label pairs)

**Left column (2fr):**
- Werkzeuge table (full-featured table with columns: Name, Kategorie, Hersteller, Zustand, Lagerort, Seriennr.)
- Table has: search/filter bar at top, sortable columns, pagination
- Each row has edit (pencil icon) and delete (trash icon) actions on hover
- Clicking a row expands inline detail or opens a side panel

**Right column (1fr):**
- **Top card:** "Nächste Wartungen" - compact list with 8 items, overdue highlighted
- **Bottom card:** "Aktive Zuweisungen" - compact list of active tool assignments
- Each card has a "+" button for creating new entries
- Each item has hover-revealed edit/delete icons

### What Appears on Hover
- Table rows: subtle background highlight + edit/delete action icons appear on right
- Stat items: tooltip with additional context
- Maintenance items: edit/delete icons slide in from right
- Assignment items: edit/delete icons slide in from right
- Cards: subtle shadow increase

### Clickable/Interactive Areas
- Table rows: click to open detail dialog showing all fields
- Maintenance items: click to open detail/edit dialog
- Assignment items: click to open detail/edit dialog
- Stats: not clickable (self-explanatory numbers)

---

## 6. Components

### Hero KPI
The MOST important metric that users see first.

- **Title:** Handlungsbedarf (Attention Required)
- **Data source:** Cross-app calculation:
  - Werkzeuge where zustand is "reparaturbeduerftig" or "defekt"
  - Wartung where naechste_wartung < today
  - Werkzeugzuweisung where geplante_rueckgabe < today AND tatsaechliche_rueckgabe is null
- **Calculation:** Count of all items needing attention (sum of defective tools + overdue maintenance + overdue returns)
- **Display:** Large 64px bold number with subtitle "Werkzeuge brauchen Aufmerksamkeit". Below: three inline breakdown indicators with colored dots (amber for maintenance, red for defective, blue for overdue returns)
- **Context shown:** Breakdown into three categories with individual counts
- **Why this is the hero:** The workshop manager's #1 question is "what needs my attention right now?" This answers it in under 1 second.

### Secondary KPIs

**Werkzeuge gesamt (Total Tools)**
- Source: Werkzeuge
- Calculation: Count of all records
- Format: number
- Display: Inline stat, not a card. Number in 24px/600, label in 13px muted

**Zugewiesen (Currently Assigned)**
- Source: Werkzeugzuweisung where tatsaechliche_rueckgabe is null
- Calculation: Count of distinct werkzeug IDs in active assignments
- Format: number
- Display: Inline stat

**Verfügbar (Available)**
- Source: Total tools minus assigned minus defective
- Calculation: Total - Assigned - Defective count
- Format: number
- Display: Inline stat

**In Wartung (In Maintenance - currently being serviced)**
- Source: Werkzeuge where zustand is "reparaturbeduerftig"
- Calculation: Count
- Format: number
- Display: Inline stat

### Chart
- **Type:** Bar chart - because we're comparing discrete categories (tool conditions), not showing trends over time
- **Title:** Werkzeugzustand Übersicht (Tool Condition Overview)
- **What question it answers:** "What's the overall health of our tool inventory?" - helps the manager see if too many tools are degrading
- **Data source:** Werkzeuge, grouped by zustand field
- **X-axis:** Zustand categories (Neu, Sehr gut, Gut, Befriedigend, Reparaturbedürftig, Defekt)
- **Y-axis:** Count of tools
- **Colors:** Green gradient for good conditions (Neu, Sehr gut, Gut), amber for Befriedigend, red for Reparaturbedürftig/Defekt
- **Mobile simplification:** Horizontal bar chart on mobile (labels read better), vertical on desktop
- **Position:** On desktop, appears below the main tool table in the left column. On mobile, appears between stats row and tool list.

### Lists/Tables

**Werkzeuge (Tool Inventory)**
- Purpose: Full inventory view - the main data management interface
- Source: Werkzeuge app
- Fields shown in list/table: Werkzeugname, Kategorie (badge), Hersteller, Zustand (color-coded badge), Lagerort, Seriennummer
- Fields shown in detail: All fields including Kaufdatum, Kaufpreis, Modellnummer
- Mobile style: Compact cards with name, category badge, and condition badge
- Desktop style: Full table with sortable columns
- Sort: By zustand priority (worst first) then by name
- Limit: Paginated, 10 per page on mobile, 15 on desktop
- Filter: Search by name, filter by Kategorie dropdown, filter by Zustand dropdown

**Nächste Wartungen (Upcoming Maintenance)**
- Purpose: Shows what maintenance is due or overdue so the manager can schedule work
- Source: Wartung app (filtered to records with naechste_wartung in the future or overdue)
- Fields shown: Werkzeug name (resolved from applookup), Wartungstyp (badge), Wartungsdatum (last performed), Nächste Wartung date
- Mobile style: Compact list items with colored left border (red if overdue)
- Desktop style: Compact card list in right sidebar
- Sort: By naechste_wartung ascending (overdue first)
- Limit: 8 items

**Aktive Zuweisungen (Active Assignments)**
- Purpose: Shows which tools are currently checked out and to whom
- Source: Werkzeugzuweisung where tatsaechliche_rueckgabe is null
- Fields shown: Mitarbeiter name (resolved), Werkzeug name (resolved), Projekt name (resolved, if set), Geplante Rückgabe date
- Mobile style: Cards with clear name hierarchy
- Desktop style: Compact list in right sidebar
- Sort: By geplante_rueckgabe ascending (overdue first)
- Limit: 8 items

### Primary Action Button (REQUIRED!)

- **Label:** "Werkzeug zuweisen" (Assign Tool)
- **Action:** add_record
- **Target app:** Werkzeugzuweisung
- **What data:**
  - Werkzeug (Select from Werkzeuge app - applookup)
  - Mitarbeiter (Select from Mitarbeiter app - applookup)
  - Projekt (Optional, Select from Projekte app - applookup)
  - Zuweisungsdatum (Date, default: today)
  - Geplante Rückgabe (Date)
  - Notizen (optional textarea)
- **Mobile position:** bottom_fixed (full-width amber button at screen bottom)
- **Desktop position:** header (top-right, medium-sized amber button)
- **Why this action:** Assigning tools to employees is the most frequent daily action. Managers check tools in and out constantly. Making this one-tap accessible is critical.

### CRUD Operations Per App (REQUIRED!)

**Mitarbeiter CRUD Operations**

- **Create (Erstellen):**
  - Trigger: "+" button in Mitarbeiter management section (accessible via a "Team" tab/section)
  - Form fields: Vorname (text, required), Nachname (text, required), Personalnummer (text), Abteilung (select from lookup_data), Telefonnummer (tel), E-Mail (email)
  - Form style: Dialog/Modal
  - Required fields: Vorname, Nachname
  - Default values: None

- **Read (Anzeigen):**
  - List view: Table on desktop, card list on mobile. Shows Vorname + Nachname combined, Personalnummer, Abteilung badge, Telefonnummer
  - Detail view: Click row → Dialog showing all fields
  - Sort: By Nachname alphabetically
  - Filter: Search by name

- **Update (Bearbeiten):**
  - Trigger: Pencil icon on hover (desktop) / in detail view (mobile)
  - Edit style: Same dialog as Create, pre-filled with current values

- **Delete (Löschen):**
  - Trigger: Trash icon on hover (desktop) / in detail view (mobile)
  - Confirmation: "Möchtest du den Mitarbeiter '{Vorname} {Nachname}' wirklich löschen?"

**Werkzeuge CRUD Operations**

- **Create (Erstellen):**
  - Trigger: "+" button in Werkzeuge section header
  - Form fields: Werkzeugname (text, required), Kategorie (select), Hersteller (text), Modellnummer (text), Seriennummer (text), Kaufdatum (date), Kaufpreis (number), Zustand (select), Lagerort (text)
  - Form style: Dialog/Modal
  - Required fields: Werkzeugname
  - Default values: Zustand = "neu", Kaufdatum = today

- **Read (Anzeigen):**
  - List view: Table on desktop (Name, Kategorie, Hersteller, Zustand, Lagerort, Seriennr.), cards on mobile
  - Detail view: Click row → Dialog showing ALL fields including Kaufpreis, Kaufdatum, Modellnummer
  - Sort: By zustand priority (worst first), then by name
  - Filter: Search by name, filter by Kategorie, filter by Zustand

- **Update (Bearbeiten):**
  - Trigger: Pencil icon in table row (desktop) / in detail view (mobile)
  - Edit style: Same dialog as Create, pre-filled

- **Delete (Löschen):**
  - Trigger: Trash icon in table row (desktop) / in detail view (mobile)
  - Confirmation: "Möchtest du das Werkzeug '{Werkzeugname}' wirklich löschen?"

**Wartung CRUD Operations**

- **Create (Erstellen):**
  - Trigger: "+" button in Wartung section header
  - Form fields: Werkzeug (applookup select from Werkzeuge), Wartungstyp (select), Wartungsdatum (date, default: today), Durchgeführt von (text), Kosten (number, EUR), Nächste Wartung fällig am (date), Notizen (textarea)
  - Form style: Dialog/Modal
  - Required fields: Werkzeug, Wartungstyp, Wartungsdatum
  - Default values: Wartungsdatum = today

- **Read (Anzeigen):**
  - List view: Compact list showing Werkzeug name (resolved), Wartungstyp badge, date, next maintenance date
  - Detail view: Click item → Dialog showing all fields including Kosten and Notizen
  - Sort: By Wartungsdatum descending (most recent first)
  - Filter: Filter by Wartungstyp

- **Update (Bearbeiten):**
  - Trigger: Pencil icon on hover / in detail view
  - Edit style: Same dialog as Create, pre-filled

- **Delete (Löschen):**
  - Trigger: Trash icon on hover / in detail view
  - Confirmation: "Möchtest du diesen Wartungseintrag wirklich löschen?"

**Projekte CRUD Operations**

- **Create (Erstellen):**
  - Trigger: "+" button in a Projekte management section (accessible via a "Projekte" tab)
  - Form fields: Projektname (text, required), Projektnummer (text), Kundenname (text), Straße (text), Hausnummer (text), Postleitzahl (text), Stadt (text), Startdatum (date), Enddatum (date), Projektleiter (text)
  - Form style: Dialog/Modal
  - Required fields: Projektname
  - Default values: Startdatum = today

- **Read (Anzeigen):**
  - List view: Table showing Projektname, Projektnummer, Kundenname, Startdatum, Enddatum, Projektleiter
  - Detail view: Click → Dialog showing all fields including address
  - Sort: By Startdatum descending
  - Filter: Search by Projektname or Kundenname

- **Update (Bearbeiten):**
  - Trigger: Pencil icon on hover / in detail view
  - Edit style: Same dialog as Create, pre-filled

- **Delete (Löschen):**
  - Trigger: Trash icon on hover / in detail view
  - Confirmation: "Möchtest du das Projekt '{Projektname}' wirklich löschen?"

**Werkzeugzuweisung CRUD Operations**

- **Create (Erstellen):**
  - Trigger: Primary action button "Werkzeug zuweisen" (header + fixed bottom on mobile)
  - Form fields: Werkzeug (applookup select), Mitarbeiter (applookup select), Projekt (optional applookup select), Zuweisungsdatum (date, default: today), Geplante Rückgabe (date), Notizen (textarea)
  - Form style: Dialog/Modal
  - Required fields: Werkzeug, Mitarbeiter, Zuweisungsdatum
  - Default values: Zuweisungsdatum = today

- **Read (Anzeigen):**
  - List view: Cards/list showing resolved Werkzeug name, Mitarbeiter name, Projekt name, dates
  - Detail view: Click → Dialog showing all fields + option to mark as returned (set tatsaechliche_rueckgabe)
  - Sort: By Zuweisungsdatum descending
  - Filter: Toggle "Nur aktive" (where tatsaechliche_rueckgabe is null)

- **Update (Bearbeiten):**
  - Trigger: Pencil icon / in detail view. Special action: "Rückgabe erfassen" button sets tatsaechliche_rueckgabe to today
  - Edit style: Same dialog as Create, pre-filled. Plus a special "Rückgabe" action button.

- **Delete (Löschen):**
  - Trigger: Trash icon / in detail view
  - Confirmation: "Möchtest du diese Zuweisung wirklich löschen?"

---

## 7. Visual Details

### Border Radius
Rounded (12px) - `--radius: 0.75rem`. Gives a modern, approachable feel without being too playful. Buttons use pill shape (9999px) for the primary action to make it stand out.

### Shadows
Subtle - Cards use `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)`. On hover, cards elevate to `0 4px 12px rgba(0,0,0,0.08)`. This creates gentle depth without heaviness.

### Spacing
Spacious - 24px gap between major sections, 16px within cards, 32px page padding on desktop, 16px on mobile. The generous spacing lets the content breathe and creates clear visual grouping.

### Animations
- **Page load:** Stagger fade-in - sections appear one by one with 50ms delay, opacity 0→1 with translateY(8px)→0
- **Hover effects:** Cards: shadow transition 200ms ease. Table rows: background-color transition 150ms. Action icons: opacity 0→1 on parent hover.
- **Tap feedback:** Active state scales to 0.98 for buttons. List items get a brief background flash.
- **Attention dot:** Amber dot on hero pulses with a 2s infinite animation (opacity 0.5→1→0.5)

---

## 8. CSS Variables (Copy Exactly!)

The implementer MUST copy these values exactly into `src/index.css`:

```css
:root {
  --radius: 0.75rem;
  --background: hsl(210 20% 98%);
  --foreground: hsl(215 25% 15%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(215 25% 15%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(215 25% 15%);
  --primary: hsl(35 92% 50%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(210 15% 96%);
  --secondary-foreground: hsl(215 25% 15%);
  --muted: hsl(210 15% 96%);
  --muted-foreground: hsl(215 15% 50%);
  --accent: hsl(210 45% 94%);
  --accent-foreground: hsl(215 25% 15%);
  --destructive: hsl(0 72% 51%);
  --border: hsl(210 15% 90%);
  --input: hsl(210 15% 90%);
  --ring: hsl(35 92% 50%);
  --chart-1: hsl(35 92% 50%);
  --chart-2: hsl(152 55% 42%);
  --chart-3: hsl(210 45% 55%);
  --chart-4: hsl(280 45% 55%);
  --chart-5: hsl(15 80% 55%);
  --sidebar: hsl(210 20% 98%);
  --sidebar-foreground: hsl(215 25% 15%);
  --sidebar-primary: hsl(35 92% 50%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(210 45% 94%);
  --sidebar-accent-foreground: hsl(215 25% 15%);
  --sidebar-border: hsl(210 15% 90%);
  --sidebar-ring: hsl(35 92% 50%);
}
```

---

## 9. Implementation Checklist

The implementer should verify:
- [ ] Font loaded from URL above (Space Grotesk)
- [ ] All CSS variables copied exactly from Section 8
- [ ] Mobile layout matches Section 4 (vertical flow, hero dominant, fixed bottom action)
- [ ] Desktop layout matches Section 5 (2fr+1fr asymmetric, table left, lists right)
- [ ] Hero element is prominent as described (64px number, attention breakdown)
- [ ] Colors create the steel-blue + amber workshop mood described in Section 2
- [ ] CRUD patterns are consistent across all 5 apps
- [ ] Delete confirmations are in place for all apps
- [ ] Tab navigation provides access to Mitarbeiter and Projekte management
- [ ] Bar chart shows tool condition distribution
- [ ] All applookup fields resolve to display names
- [ ] Overdue items highlighted in red throughout
