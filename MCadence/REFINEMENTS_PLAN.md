# MCadence Refinements Plan

## Overview
This document outlines the planned refinements for the mcadence app, covering recurrence settings, UI cleanup, and category management.

---

## 1. Recurrence Settings for Hit My Goal & Spend My Time

### 1.1 Scope
Add recurrence configuration when creating/editing items in:
- **Hit My Goal** tab
- **Spend My Time** tab
- (Day to Day remains simple one-off tasks)

### 1.2 UI Design

**New Dropdown Fields in Add/Edit Forms:**

| Field | Options | Default |
|-------|---------|---------|
| **Frequency** | Daily, Weekly, Monthly, Annually | Weekly |
| **Occurrences** | Number input (1-999) or "Forever" | Forever |
| **Timezone** | Dropdown list of common timezones | America/New_York (EST) |

**Example UI Layout:**
```
┌─────────────────────────────────────┐
│ Title: [________________]           │
│                                     │
│ Category: [Dropdown ▼]              │
│                                     │
│ Recurrence:                         │
│ ┌─────────────┐ ┌─────────────────┐│
│ │ Weekly    ▼ │ │ Stop after: ∞  ▼││
│ └─────────────┘ └─────────────────┘│
│                                     │
│ Timezone: [America/New_York ▼]      │
│                                     │
│ [Cancel]              [Add Item]    │
└─────────────────────────────────────┘
```

### 1.3 Data Model Changes

Update `types.ts`:
```typescript
export type Frequency = "daily" | "weekly" | "monthly" | "annually";

export interface RecurrenceSettings {
  frequency: Frequency;
  occurrences: number | null; // null = forever
  timezone: string; // IANA timezone string
  startDate: string; // ISO date when recurrence started
  completedOccurrences: number; // How many times completed
}

// Add to BaseItem:
export interface BaseItem {
  // ... existing fields
  recurrence?: RecurrenceSettings; // Optional - only for recurring items
}
```

### 1.4 Timezone Dropdown Options
Provide a curated list of common timezones:
```typescript
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (EST/EDT)' },
  { value: 'America/Chicago', label: 'Central Time (CST/CDT)' },
  { value: 'America/Denver', label: 'Mountain Time (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PST/PDT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
];
```

### 1.5 Implementation Tasks
- [ ] Update `types.ts` with RecurrenceSettings interface
- [ ] Update `constants.ts` with TIMEZONE_OPTIONS
- [ ] Create `RecurrenceSelector.tsx` component
- [ ] Update `HitMyGoalTab.tsx` add form to include recurrence
- [ ] Update `SpendMyTimeTab.tsx` add form to include recurrence
- [ ] Update `state.tsx` to handle recurrence in addChecklistItem and addTimeItem
- [ ] Add logic to track completed occurrences and auto-stop when limit reached

---

## 2. Remove Color Section from Spend My Time Form

### 2.1 Current State
The "Spend My Time" add form currently shows:
> "Color is automatically assigned based on the selected category"

### 2.2 Change
Remove this text entirely from the SpendMyTimeTab add/edit form since:
- Color is already automatic based on category
- Users don't need to see this message

### 2.3 Implementation Tasks
- [ ] Remove color section text from `SpendMyTimeTab.tsx` add modal

---

## 3. Category Management System

### 3.1 Overview
Enable users to customize categories and subcategories, with the ability to import/export category configurations.

### 3.2 New Features

#### 3.2.1 Edit Categories Button
Add "Edit Categories" button to the top-right menu dropdown.

**Menu Structure:**
```
┌─────────────────────────┐
│ Menu                    │
│ ─────────────────────── │
│ Export Data             │
│ Import Data             │
│ Edit Categories    NEW  │
│ ─────────────────────── │
│ Clear All Data          │
│ ─────────────────────── │
│ Items: 5 | Actions: 12  │
└─────────────────────────┘
```

#### 3.2.2 Category Editor Modal
A full-screen or large modal for managing categories:

```
┌─────────────────────────────────────────────────┐
│ Edit Categories                              ✕  │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Import Categories] [Export Categories]         │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ 📁 必要日常 (Black)                    [+ Sub]  │
│    ├─ 🛏️ 睡觉/休息                    [Edit][✕] │
│    ├─ 💼 工作                          [Edit][✕] │
│    ├─ 🚿 洗漱                          [Edit][✕] │
│    └─ ... more                                  │
│                                                 │
│ 📁 副业 (Yellow)                       [+ Sub]  │
│    ├─ 🚀 副业筹备                      [Edit][✕] │
│    └─ ... more                                  │
│                                                 │
│ [+ Add Category]                                │
│                                                 │
│ ─────────────────────────────────────────────── │
│ [Reset to Defaults]              [Save Changes] │
└─────────────────────────────────────────────────┘
```

#### 3.2.3 Add/Edit Category Form
```
┌─────────────────────────────────────┐
│ Add Category                        │
├─────────────────────────────────────┤
│ Name: [________________]            │
│                                     │
│ Color: [● Red ▼]                    │
│                                     │
│ [Cancel]             [Save]         │
└─────────────────────────────────────┘
```

#### 3.2.4 Add/Edit Subcategory Form
```
┌─────────────────────────────────────┐
│ Add Subcategory                     │
├─────────────────────────────────────┤
│ Name: [________________]            │
│                                     │
│ Icon: [😀 ▼] (emoji picker)         │
│                                     │
│ [Cancel]             [Save]         │
└─────────────────────────────────────┘
```

### 3.3 Category Data Storage

#### 3.3.1 Separate Categories JSON
Categories will be stored separately and can be exported/imported independently.

**Export Format (`mcadence-categories.json`):**
```json
{
  "version": "1.0",
  "exportedAt": "2026-01-12T19:00:00Z",
  "categories": [
    {
      "id": "cat-daily-essentials",
      "name": "必要日常",
      "color": "#000000",
      "subcategories": [
        { "id": "sub-sleep", "name": "睡觉/休息", "icon": "🛏️", "parentId": "cat-daily-essentials" },
        { "id": "sub-work", "name": "工作", "icon": "💼", "parentId": "cat-daily-essentials" }
      ]
    }
  ]
}
```

#### 3.3.2 Storage Strategy
- Categories stored in localStorage under key: `mcadence_categories_v1`
- Default categories loaded from `constants.ts` if no custom categories exist
- Main data export includes category reference by ID (not embedded)

### 3.4 Implementation Tasks
- [ ] Create `CategoryEditorModal.tsx` component
- [ ] Create `CategoryForm.tsx` for add/edit category
- [ ] Create `SubcategoryForm.tsx` for add/edit subcategory
- [ ] Add category storage functions to `storage.ts`
- [ ] Add "Edit Categories" button to menu in `HomePageContent.tsx`
- [ ] Add category import/export functions
- [ ] Update CategorySelector to use dynamic categories from state
- [ ] Add "Reset to Defaults" functionality

---

## Implementation Order

### Phase 1: Remove Color Section (Quick Win)
1. Remove color text from SpendMyTimeTab.tsx

### Phase 2: Recurrence Settings
1. Update types.ts with RecurrenceSettings
2. Add TIMEZONE_OPTIONS to constants.ts
3. Create RecurrenceSelector component
4. Update HitMyGoalTab form
5. Update SpendMyTimeTab form
6. Update state.tsx action creators

### Phase 3: Category Management
1. Create category storage functions
2. Create CategoryEditorModal
3. Add menu button
4. Implement import/export
5. Update CategorySelector to use dynamic categories

---

## Questions/Decisions Needed

1. **Emoji Picker**: Should we use a full emoji picker library or a simple dropdown with preset emojis?
   - **Recommendation**: Start with preset emoji list, can add full picker later

2. **Category Deletion**: What happens to items when their category is deleted?
   - **Recommendation**: Move items to "Uncategorized" or prevent deletion if items exist

3. **Recurrence Reset**: For "Spend My Time", when does the weekly timer reset?
   - **Current**: Monday 00:00 EST
   - **Change**: Should respect user's selected timezone

---

## Approval

Please review this plan and let me know:
- [ ] Approved as-is
- [ ] Approved with modifications (please specify)
- [ ] Need more details on specific sections

Once approved, I'll implement each phase step by step, checking in after each major change.
