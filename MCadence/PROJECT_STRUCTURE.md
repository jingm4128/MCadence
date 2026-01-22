# MCadence Project Structure

This document provides a comprehensive overview of the MCadence codebase to assist with future development.

## Overview

MCadence is a productivity tracking application built with Next.js 14 (App Router), React, and TypeScript. It features:
- Three-tab task management (Day to Day, Hit My Goal, Spend My Time)
- Time tracking with timer functionality (supports concurrent timers)
- AI-powered features (Quick Add, Insights, Cleanup suggestions)
- Multi-provider AI support (OpenAI, Gemini, Anthropic)
- Local storage persistence
- Settings panel with customizable preferences
- Automatic backups with configurable frequency
- Configurable swipe gestures per tab
- Long press to edit items (SpendMyTime: name, category, and time spent)

---

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page (entry point)
│   ├── globals.css         # Global styles (Tailwind)
│   └── api/                # API Routes
│       ├── insight/route.ts    # AI Insight generation
│       ├── quickadd/route.ts   # AI Quick Add parsing
│       └── cleanup/route.ts    # AI Cleanup suggestions
│
├── components/             # React Components
│   ├── HomePageContent.tsx     # Main app container
│   ├── layout/             # Layout components
│   │   ├── Header.tsx          # App header
│   │   └── Layout.tsx          # Main layout wrapper
│   ├── tabs/               # Tab content components
│   │   ├── DayToDayTab.tsx     # Checklist tab (daily tasks)
│   │   ├── HitMyGoalTab.tsx    # Checklist tab (goals)
│   │   └── SpendMyTimeTab.tsx  # Time tracking tab
│   ├── ui/                 # Reusable UI components
│   │   ├── Button.tsx          # Button component
│   │   ├── Modal.tsx           # Base modal component
│   │   ├── CategoryEditorModal.tsx  # Category management
│   │   ├── CategorySelector.tsx     # Category dropdown
│   │   ├── ImportExportModal.tsx    # Data import/export
│   │   ├── ProgressBar.tsx          # Progress visualization
│   │   ├── RecurrenceSelector.tsx   # Recurrence settings (with interval support)
│   │   ├── SettingsModal.tsx        # App settings (backup, timers, swipe config)
│   │   ├── SwipeableItem.tsx        # Swipe gestures (configurable actions)
│   │   ├── TabBar.tsx               # Tab navigation
│   │   └── TabHeader.tsx            # Shared tab header (archive icon, add button, filter)
│   └── ai/                 # AI Feature components
│       ├── AiPanel.tsx         # AI settings panel
│       ├── InsightCard.tsx     # Insight display
│       ├── QuickAddSection.tsx # Quick add UI
│       └── CleanupSection.tsx  # Cleanup suggestions UI
│
├── lib/                    # Core libraries
│   ├── types.ts            # TypeScript type definitions
│   ├── constants.ts        # Application constants
│   ├── storage.ts          # LocalStorage persistence
│   ├── state.tsx           # React Context for app state
│   └── ai/                 # AI-related modules
│       ├── providers.ts        # AI provider configurations
│       ├── settings.ts         # User AI settings management
│       ├── server-config.ts    # Server-side AI config
│       ├── types.ts            # Shared AI types
│       ├── utils.ts            # Shared AI utilities (NEW)
│       ├── insight/            # AI Insights module
│       │   ├── index.ts            # Public exports
│       │   ├── types.ts            # Insight-specific types
│       │   ├── stats.ts            # Stats builder
│       │   └── generate.ts         # Insight generator
│       ├── quickadd/           # AI Quick Add module
│       │   ├── index.ts            # Public exports
│       │   ├── types.ts            # QuickAdd-specific types
│       │   └── generate.ts         # Proposal generator
│       └── cleanup/            # AI Cleanup module
│           ├── index.ts            # Public exports
│           ├── types.ts            # Cleanup-specific types
│           ├── stats.ts            # Cleanup stats builder
│           └── generate.ts         # Suggestion generator
│
├── hooks/                  # Custom React hooks
│   ├── index.ts                # Hook exports
│   └── useHistoryGuard.ts      # History/back navigation
│
└── utils/                  # Utility functions
    ├── date.ts                 # Date/time utilities
    └── uuid.ts                 # UUID generation
```

---

## Core Modules

### 1. Type System (`src/lib/types.ts`)

Central type definitions used throughout the app:

```typescript
// Tab identifiers
type TabId = "dayToDay" | "hitMyGoal" | "spendMyTime";

// Base item structure (common fields)
interface BaseItem {
  id: string;
  tab: TabId;
  title: string;
  isArchived: boolean;
  isDeleted?: boolean;    // Soft-delete flag (keeps data, hides from UI)
  deletedAt?: string;     // When the item was soft-deleted
  dueDate?: string | null; // Optional due date (ISO timestamp) - items with no dueDate sort to bottom
  // ... other fields
}

// Item types
interface ChecklistItem extends BaseItem { ... }  // For dayToDay, hitMyGoal
interface TimeItem extends BaseItem { ... }       // For spendMyTime

// Recurrence settings (supports arbitrary intervals)
interface RecurrenceSettings {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;           // e.g., 2 = every 2 days/weeks/months
  totalOccurrences: number;
  completedOccurrences: number;
  nextDue?: string;
}

// Type guards
isChecklistItem(item)  // Check if dayToDay or hitMyGoal
isTimeItem(item)       // Check if spendMyTime
```

### 2. State Management (`src/lib/state.tsx`)

React Context providing global app state:

```typescript
const { state, addChecklistItem, addTimeItem, updateItem, ... } = useAppState();

// Archive features
archiveAllCompletedInTab(tabId)  // Batch archive all completed items in a tab
isItemCompleted(item)            // Helper to check completion status

// Item sorting by due date
// Items are sorted by effective due date (dueDate || recurrence.nextDue)
// Items with no due date are placed at the bottom
```

**Soft-Delete Behavior:**

Items are soft-deleted rather than hard-deleted:
- When deleted, items are marked with `isDeleted: true` and `deletedAt` timestamp
- Item data and all action logs are preserved in storage (for history/analytics)
- Soft-deleted items are filtered out from all UI views
- Recurring items that are deleted will NOT generate new occurrences

**Recurring Item Auto-Creation:**

The state provider includes a useEffect that automatically creates new period items when periods pass for date-tagged recurring items:
- Recurring items use `periodKey` (YYYYMMDD format) to track which period they belong to
- When a period passes (e.g., yesterday's daily item), a new item is created for the current period
- Old items are marked as "missed" if not completed
- **Deduplication**: A `processedRecurrences` Set prevents duplicate items when multiple old period items exist for the same recurring task

### 3. Constants (`src/lib/constants.ts`)

Application constants including:
- `STORAGE_KEY` - LocalStorage key
- `DEFAULT_CATEGORIES` - Pre-populated categories
- `TAB_CONFIG` - Tab metadata (labels, icons)
- `ITEM_STATUS` - Status constants (active, done, missed)
- `FREQUENCY_OPTIONS` - Recurrence frequencies

### 4. Storage (`src/lib/storage.ts`)

LocalStorage persistence functions:
- `loadState()` / `saveState()` - App state
- `loadCategories()` / `saveCategories()` - Categories
- `exportState()` / `importState()` - Import/export
- `loadSettings()` / `saveSettings()` - App settings

### 5. App Settings (`src/lib/types.ts` + `src/lib/storage.ts`)

Configurable app settings with persistence:

```typescript
interface AppSettings {
  // Backup settings
  backupFrequency: 'never' | 'daily' | 'weekly' | 'monthly';
  lastBackupDate?: string;
  
  // Timer concurrency
  allowConcurrentTimers: boolean;  // Allow multiple timers in Spend My Time
  
  // Week start day (0=Sunday, 1=Monday, ..., 6=Saturday)
  weekStartDay: WeekStartDay;  // Affects recurring item due dates for weekly items
  
  // Swipe action configuration per tab
  swipeConfig: {
    dayToDay: { left: SwipeAction; right: SwipeAction };
    hitMyGoal: { left: SwipeAction; right: SwipeAction };
    spendMyTime: { left: SwipeAction; right: SwipeAction };
  };
}

type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;  // Sunday=0 through Saturday=6
type SwipeAction = 'delete' | 'archive';
```

Backup functions:
```typescript
isBackupDue(settings)       // Check if backup should run
performAutoBackup()         // Create and download backup
getTimeUntilNextBackup()    // Human-readable time until next
```

---

## AI Architecture

### Provider Configuration (`src/lib/ai/providers.ts`)

Supports three AI providers:
- **OpenAI** (GPT-4o-mini, GPT-4o, GPT-4-turbo, GPT-3.5-turbo)
- **Gemini** (Gemini-2.0-flash, Gemini-1.5-flash, Gemini-1.5-pro)
- **Anthropic** (Claude-3.5-sonnet, Claude-3.5-haiku, Claude-3-opus)

Key functions:
```typescript
callAIProvider(params)           // Make API call to any provider
validateAPIKeyForProvider(key)   // Validate API key format
detectProviderFromKey(key)       // Auto-detect provider from key
```

### Settings Management (`src/lib/ai/settings.ts`)

Client-side AI settings:
```typescript
loadUserSettings()      // Load from localStorage
saveUserSettings()      // Save to localStorage
getEffectiveSettings()  // Get computed settings
getAIRequestConfig()    // Get config for API calls
isAIEnabled()           // Check if AI is available
```

### Server Configuration (`src/lib/ai/server-config.ts`)

Server-side AI call handling:
```typescript
makeServerAICall(params)    // Execute AI call with proper key
extractAIConfig(body)       // Extract config from request
hasValidApiKey(config)      // Validate API key availability
```

### Shared Utilities (`src/lib/ai/utils.ts`)

Common utilities used across AI features:
```typescript
truncateTitle(title, maxLen)     // Truncate with ellipsis
extractJSONFromText<T>(text)     // Extract JSON from AI response
getErrorStatusCode(errorMessage) // Map errors to HTTP status
clamp(value, min, max)           // Clamp numeric value
```

---

## AI Features

### 1. Quick Add (`src/lib/ai/quickadd/`)

Parses natural language into structured tasks/goals/projects.

**Flow:**
1. User enters text → `QuickAddSection.tsx`
2. Client calls `/api/quickadd` with text + categories
3. Server calls AI via `makeServerAICall()`
4. AI returns proposals with tab, recurrence, duration
5. User edits/approves proposals → items created

### 2. Insights (`src/lib/ai/insight/`)

Generates weekly productivity insights from aggregated stats.

**Flow:**
1. Stats computed locally → `buildInsightStats()`
2. Stats sent to `/api/insight`
3. AI generates highlights, patterns, friction, encouragement
4. Insights displayed in `InsightCard.tsx`

### 3. Cleanup (`src/lib/ai/cleanup/`)

Suggests items to archive or delete based on staleness.

**Flow:**
1. Cleanup candidates identified → `buildCleanupStats()`
2. Stats sent to `/api/cleanup`
3. AI suggests archive/delete actions with reasons
4. User reviews in `CleanupSection.tsx`

---

## Date Utilities (`src/utils/date.ts`)

Comprehensive date handling using dayjs:

```typescript
// Core
getNowNY()                    // Current time in NY timezone
getWeekStart() / getWeekEnd() // Week boundaries

// Period ranges (for AI Insights)
getThisWeekRangeNY()
getLast7DaysRangeNY()
getCustomRangeNY(start, end)

// Recurrence helpers
calculateNextDue(currentDue, frequency, interval)  // Supports arbitrary intervals
getInitialDueDate(frequency)
advanceRecurrence(settings)                        // Honors interval from settings

// Period keys for recurring items
getCurrentPeriodKey(frequency)
formatTitleWithPeriod(title, periodKey)
isPeriodPassed(periodKey, frequency)

// Urgency status (for deadline alerts)
getUrgencyStatus(nextDue, isComplete)              // Basic time-based urgency
getUrgencyStatusWithWork(nextDue, remainingMin, isComplete)  // Work-based urgency
// Alert when: time left < 3X of remaining work time
// Effective due date: uses dueDate if set, otherwise recurrence.nextDue
```

---

## Component Patterns

### Tab Components

Each tab follows a similar pattern:
1. Filter items by tab
2. Separate active vs done/archived
3. Render item list with SwipeableItem wrapper for swipe gestures
4. Handle add/edit/delete/complete

### SwipeableItem Component (`src/components/ui/SwipeableItem.tsx`)

A reusable wrapper that enables swipe and long press gestures on list items:
- **Swipe left** → Configurable action (delete or archive)
- **Swipe right** → Configurable action (delete or archive)
- **Long press** → Opens edit modal (for SpendMyTime items: edit name, category, and time spent)

```typescript
<SwipeableItem
  onSwipeLeft={swipeHandlers.onSwipeLeft}
  onSwipeRight={swipeHandlers.onSwipeRight}
  onLongPress={() => handleEditItem(item)}  // Optional: long press callback
  leftLabel={swipeHandlers.leftLabel}       // "Delete" or "Archive"
  rightLabel={swipeHandlers.rightLabel}     // "Delete" or "Archive"
  leftColor={swipeHandlers.leftColor}       // bg-red-500 or bg-blue-500
  rightColor={swipeHandlers.rightColor}     // bg-red-500 or bg-blue-500
  longPressDelay={500}                      // Optional: delay in ms (default: 500)
  disabled={isActive}  // Optional: disable swipe during active timer
>
  {/* Item content */}
</SwipeableItem>
```

Supports both touch (mobile) and mouse (desktop) interactions.
Swipe actions are configurable per-tab in Settings.
Long press on SpendMyTime items opens an edit modal for name, category, and completed time.
Recurrence editing remains accessible via the small recurrence icon on items.

### TabHeader Component (`src/components/ui/TabHeader.tsx`)

Shared header component used across all three tabs with unified styling:
- **Archive Icon Button** - Box icon that toggles archive view
  - Click: Toggle between active items and archived items view
  - Long press (500ms): Archive all completed items in the current tab
  - Shows count badge when there are archived items
  - Shows green dot indicator when there are completed items to archive
  - Tooltip shows "Long press to archive X completed" on hover
- **Add Button** - "+" icon to open add item modal
- **Category Filter** - Dropdown to filter items by category

All buttons use unified sizing (w-9 h-9) for visual consistency.

### SettingsModal Component (`src/components/ui/SettingsModal.tsx`)

Central settings panel accessible from the menu:
- **Category Management** - Edit categories (moved from direct menu item)
- **Backup Settings** - Configure auto-backup frequency (never/daily/weekly/monthly)
- **Timer Settings** - Enable/disable concurrent timers for Spend My Time
- **Swipe Configuration** - Customize swipe left/right actions per tab

### AI Components

Pattern for AI feature components:
1. Check if AI is enabled
2. Show loading state during API call
3. Display results with edit capability
4. Handle approval/rejection

---

## API Route Pattern

All AI routes follow this pattern:

```typescript
export async function POST(request: NextRequest) {
  // 1. Validate request size
  // 2. Parse and validate body
  // 3. Extract AI config
  // 4. Check API key availability
  // 5. Call makeServerAICall()
  // 6. Extract and validate JSON response
  // 7. Return success or error
}
```

---

## Key Files for Common Tasks

| Task | Files |
|------|-------|
| Add new item type | `types.ts`, `state.tsx`, tab component |
| Add AI feature | `ai/*/types.ts`, `ai/*/generate.ts`, `api/*/route.ts`, component |
| Change date logic | `utils/date.ts` |
| Modify categories | `constants.ts`, `CategoryEditorModal.tsx` |
| Change storage | `storage.ts` |
| Add new provider | `ai/providers.ts`, `ai/server-config.ts` |
| Modify settings | `types.ts` (AppSettings), `storage.ts`, `SettingsModal.tsx` |
| Change swipe behavior | `storage.ts` (DEFAULT_SETTINGS), tab components |
| Add backup feature | `storage.ts`, `SettingsModal.tsx` |
| Add long press editing | `SwipeableItem.tsx`, tab component (add onLongPress handler) |


