# MCadence Web App - Detailed Implementation Plan

## Project Overview

MCadence is a personal time & energy management tool built with Next.js, TypeScript, and Tailwind CSS. It features three main tabs for different types of task management, with localStorage persistence and PWA capabilities.

## Technical Specifications

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS (mobile-first)
- **Hosting**: Vercel-ready
- **Data Persistence**: localStorage only (no backend)
- **PWA**: Basic manifest + service worker for "Add to Home Screen"

### App Structure
Single-page application with:
- Top: App title "mcadence" and Menu button
- Body: Active tab content
- Bottom: 3-tab bar with icons + labels

## Data Models (TypeScript Interfaces)

```typescript
export type TabId = "dayToDay" | "hitMyGoal" | "spendMyTime";

export type ItemStatus = "active" | "done" | "archived";

export type Frequency = "weekly"; // v1: just support weekly, Monday–Sunday, America/New_York

export interface BaseItem {
  id: string; // uuid
  tab: TabId;
  title: string;
  category: string;  // string label (user-editable)
  color: string;     // CSS color or tailwind class name; user can override
  sortKey: number;   // for ordering within tab
  status: ItemStatus;
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
  archivedAt?: string | null;
}

export interface ChecklistItem extends BaseItem {
  tab: "dayToDay" | "hitMyGoal";
  isDone: boolean;
  completedAt?: string | null;
}

export interface TimeProject extends BaseItem {
  tab: "spendMyTime";
  frequency: Frequency; // "weekly" for now
  requiredMinutes: number;   // e.g. 20h = 1200
  completedMinutes: number;  // accumulated in current period
  currentSessionStart?: string | null; // ISO when timing is running
  periodStart: string;  // current period start (week)
  periodEnd: string;    // current period end (week)
}

export type Item = ChecklistItem | TimeProject;

export type ActionType =
  | "create"
  | "update"
  | "archive"
  | "delete"
  | "complete"
  | "timer_start"
  | "timer_stop";

export interface ActionLog {
  id: string;
  itemId: string;
  tab: TabId;
  type: ActionType;
  timestamp: string; // ISO
  payload?: any;     // optional details e.g. previousValues / newValues / durationMinutes
}

export interface AppState {
  items: Item[];
  actions: ActionLog[];
}
```

## Detailed Feature Implementation

### 1. Storage Layer

**localStorage Structure:**
- Key: `"mcadence_state_v1"`
- Value: JSON string of `AppState`

**Implementation Details:**
- Debounced writes (300ms) to prevent hammering localStorage
- Data validation on load with fallback to empty state
- Error handling for corrupted data

### 2. Tab 1: Day to Day (Checklist)

**Display:**
- Items belonging to `tab: "dayToDay"`
- Show: title, category (small label), color (accent/left border), checkbox (isDone)

**Add Item:**
- + button opens modal/inline form
- Fields: title (required), category (optional, free text), color (optional, preset chips)
- Creates `ChecklistItem` with `isDone=false`, `status="active"`

**Toggle Done:**
- Checkbox sets `isDone` and `completedAt`
- Logs ActionLog `"complete"` on each change

**Swipe Actions:**
- Left swipe = Archive (confirmation required)
- Right swipe = Delete (confirmation required)
- Archive: `status="archived"`, `archivedAt` set, log `"archive"`
- Delete: Remove Item + all ActionLog entries for that itemId

**Archived View:**
- Hidden from main list
- Accessible via tab header
- Shows only archived items

### 3. Tab 2: Hit My Goal (Checklist)

**Implementation:** Identical to Day to Day but with `tab: "hitMyGoal"`
- Same display, add, toggle, swipe, and archive functionality
- Separate data set from Day to Day

### 4. Tab 3: Spend My Time (Time Projects)

**Display:**
- Each TimeProject as a row with:
  - Title
  - Category
  - Progress bar: `completedMinutes / requiredMinutes` (clamped 0-1)
  - Text label: "Xh Ym / Xh Ym (percentage%)"

**Weekly Period Handling:**
- Frequency: "weekly" only (v1)
- Week: Monday–Sunday, America/New_York timezone
- `periodStart`: Monday 00:00 of current week
- `periodEnd`: Sunday 23:59:59 of current week
- Week rollover check on app open and progress computation

**Add Project:**
- + button opens form
- Fields: title (required), category (optional), required time (hours + minutes)
- Initialize: `completedMinutes=0`, `currentSessionStart=null`, current week dates

**Timer Functionality:**
- Tap project row to start/stop timer
- Start: `currentSessionStart = now`, log `"timer_start"`
- Stop: Calculate elapsed minutes, add to `completedMinutes`, set `currentSessionStart=null`, log `"timer_stop"` with duration
- Single timer constraint: Stop other project before starting new one

**Visual States:**
- Active project (timer running): brightened/highlighted
- Inactive projects: slightly faded (reduced opacity)

**Visual Alerts:**
- `periodProgress = (now - periodStart) / (periodEnd - periodStart)`
- If `periodProgress >= 0.8` AND `completedMinutes / requiredMinutes < 1`: Progress bar pulses/blinks
- If `now > periodEnd` AND `completedMinutes / requiredMinutes < 1`: Title in red text

### 5. CSV Export/Import

**Export:**
- Two separate CSV files from menu action
- `mcadence_items.csv`: All item fields in wide format (empty for non-applicable)
  - Columns: id, tab, title, category, color, sortKey, status, createdAt, updatedAt, archivedAt, isDone, completedAt, frequency, requiredMinutes, completedMinutes, currentSessionStart, periodStart, periodEnd
- `mcadence_actions.csv`: All action logs
  - Columns: id, itemId, tab, type, timestamp, payloadJson
- Implementation: Browser Blob + URL.createObjectURL

**Import:**
- Menu action: "Import data from CSV"
- File selection for items.csv (required) and actions.csv (optional)
- Structure validation (header names)
- Import options:
  - **Combine**: Merge with existing data (replace by id, add new items)
  - **Overwrite**: Replace entire AppState with imported data
- Prompt user for choice before applying

### 6. Action Logging

Every important event logs ActionLog entry:
- **create**: Item/project creation
- **update**: Field changes (title, category, color, requiredMinutes)
- **archive**: Status change to archived
- **complete**: Checklist item done/undone
- **timer_start**: Timer session start
- **timer_stop**: Timer session stop with durationMinutes
- **delete**: Item deletion (for debugging/audit)

### 7. PWA Implementation

**Manifest:**
- App name: "mcadence"
- Short name: "mcadence"
- Description: Personal time & energy management tool
- Theme color, background color
- Icons: multiple sizes (192x192, 512x512)
- Start URL: "/"
- Display: standalone

**Service Worker:**
- Cache static assets (CSS, JS, images)
- Offline fallback page
- Basic cache-first strategy
- Skip waiting for immediate updates

### 8. Mobile-First Design

**Viewport Target:**
- Primary: iPhone 13 (390x844)
- Ensure usability on any phone screen

**Design Principles:**
- Bottom tab navigation for thumb accessibility
- Touch targets minimum 44px
- Swipe gestures with button fallbacks
- Readable text sizes
- Adequate spacing between interactive elements

### 9. Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Main app page
│   ├── globals.css             # Global styles + Tailwind
│   └── api/
│       └── manifest.ts         # PWA manifest endpoint
├── components/
│   ├── ui/                     # Reusable components
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── ColorPicker.tsx
│   │   └── TabBar.tsx
│   ├── layout/
│   │   ├── Header.tsx          # App header with menu
│   │   └── Layout.tsx          # Main layout wrapper
│   ├── tabs/
│   │   ├── DayToDayTab.tsx     # Random tasks checklist
│   │   ├── HitMyGoalTab.tsx    # Challenges checklist
│   │   ├── SpendMyTimeTab.tsx  # Time tracking projects
│   │   └── ArchivedView.tsx    # Shared archived items view
│   ├── forms/
│   │   ├── AddItemForm.tsx     # Add checklist item
│   │   ├── AddProjectForm.tsx  # Add time project
│   │   └── ImportExportModal.tsx # CSV import/export UI
│   └── items/
│       ├── ChecklistItem.tsx   # Individual checklist item
│       ├── TimeProject.tsx     # Individual time project
│       └── SwipeActions.tsx    # Swipe gesture handlers
├── lib/
│   ├── types.ts                # TypeScript interfaces
│   ├── storage.ts              # LocalStorage management
│   ├── timeUtils.ts            # Timezone & week calculations
│   ├── csvUtils.ts             # CSV export/import
│   ├── state.ts                # React context
│   └── constants.ts            # App constants (colors, etc.)
├── hooks/
│   ├── useAppState.ts          # App state hook
│   ├── useLocalStorage.ts      # LocalStorage hook
│   └── useTimer.ts             # Timer management hook
├── utils/
│   ├── uuid.ts                 # UUID generation
│   ├── date.ts                 # Date utilities
│   └── validation.ts           # Data validation
└── public/
    ├── manifest.json           # PWA manifest
    ├── sw.js                   # Service worker
    └── icons/                  # App icons
```

## Implementation Phases

### Phase 1: Foundation (Days 1-2)
1. **Project Setup**
   - Initialize Next.js with TypeScript and Tailwind
   - Configure project structure and paths
   - Set up ESLint, Prettier, TypeScript

2. **Core Infrastructure**
   - Define all TypeScript interfaces
   - Implement localStorage persistence
   - Create React context for state management
   - Set up basic UI components

### Phase 2: Core Tabs (Days 3-4)
3. **Layout & Navigation**
   - Create main layout with header and tab bar
   - Implement bottom navigation
   - Add menu system and modals

4. **Checklist Tabs**
   - Implement Day to Day tab
   - Implement Hit My Goal tab
   - Add item creation, toggling, archiving, deletion
   - Implement swipe actions

### Phase 3: Time Tracking (Days 5-6)
5. **Spend My Time Tab**
   - Implement time project display
   - Add timer functionality with single-timer constraint
   - Implement weekly period handling
   - Add visual alerts (80% progress, overdue)

### Phase 4: Advanced Features (Days 7-8)
6. **CSV Import/Export**
   - Implement export functionality (two files)
   - Create import interface with validation
   - Add combine/overwrite options

7. **PWA & Polish**
   - Create manifest and service worker
   - Ensure mobile responsiveness
   - Add loading states and error handling
   - Performance optimization

### Phase 5: Testing & Launch (Day 9)
8. **Quality Assurance**
   - Test all functionality on mobile devices
   - Verify data persistence and migration
   - Test CSV roundtrip import/export
   - Validate PWA installation and offline behavior

## Success Criteria

1. ✅ Working Next.js + TypeScript + Tailwind app
2. ✅ Three functional tabs with all specified behaviors
3. ✅ LocalStorage persistence with action logging
4. ✅ CSV export/import with merge/overwrite options
5. ✅ PWA-ready with "Add to Home Screen" capability
6. ✅ Mobile-optimized responsive design
7. ✅ Time tracking with weekly periods and visual alerts
8. ✅ Clean, maintainable code structure

## Risk Mitigation

1. **LocalStorage Limits**: Monitor data size, implement cleanup if needed
2. **Time Zone Issues**: Thorough testing of week boundaries and rollovers
3. **Mobile Performance**: Optimize re-renders, use React.memo appropriately
4. **PWA Compatibility**: Test across different browsers and devices
5. **Data Migration**: Handle schema changes gracefully in localStorage

This plan provides a comprehensive roadmap for building MCadence according to your specifications, with clear phases and deliverables.
