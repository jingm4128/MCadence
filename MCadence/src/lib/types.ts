export type TabId = "dayToDay" | "hitMyGoal" | "spendMyTime";

// Item status based on completion vs deadline
// - active: Within deadline, not yet completed
// - done: Completed the goal before deadline
// - missed: Deadline passed without completion
export type ItemStatus = "active" | "done" | "missed";

// Recurrence frequency for recurring items
export type Frequency = "daily" | "weekly" | "monthly" | "annually";

// RecurrenceType includes 'one_off' for non-recurring items (used by AI Quick Add)
export type RecurrenceType = "one_off" | Frequency;

// AI confidence levels
export type ConfidenceLevel = "low" | "medium" | "high";

// Category System - Hierarchical (L1/L2)
export interface Category {
  id: string;
  name: string; // L1 name (e.g., "必要日常")
  color: string; // Black, Yellow, Green, Red, Orange
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string; // L2 name (e.g., "睡觉/休息")
  icon: string; // New icon system
  parentId: string;
}

export interface RecurrenceSettings {
  frequency: Frequency;
  interval: number; // Repeat every N days/weeks/months (e.g., interval=2 with frequency=weekly means every 2 weeks)
  totalOccurrences: number | null; // null = forever, number = stop after X times
  completedOccurrences: number; // How many times the item has been completed
  timezone: string; // IANA timezone string (e.g., 'America/New_York')
  startDate: string; // ISO date when recurrence started
  nextDue?: string; // ISO timestamp for next due date
}

export interface BaseItem {
  id: string; // uuid
  tab: TabId;
  title: string; // Display title (may include period suffix like "睡觉-20260113")
  baseTitle?: string; // Original title without period suffix (for recurring items)
  categoryId: string; // Reference to subcategory
  sortKey: number;   // for ordering within tab
  status: ItemStatus; // active | done | missed
  isArchived: boolean; // Whether user has archived this item
  isDeleted?: boolean; // Whether user has soft-deleted this item (keeps data but hides from UI)
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
  archivedAt?: string | null; // When the item was archived
  deletedAt?: string | null; // When the item was soft-deleted
  dueDate?: string | null; // ISO timestamp for due date (optional, independent of recurrence)
  recurrence?: RecurrenceSettings; // For recurring items
  periodKey?: string; // Period identifier: "20260113" for due date
}

export interface ChecklistItem extends BaseItem {
  tab: "dayToDay" | "hitMyGoal";
  isDone: boolean;
  completedAt?: string | null;
}

export interface TimeItem extends BaseItem { // Renamed from TimeProject
  tab: "spendMyTime";
  requiredMinutes: number;   // e.g. 20h = 1200
  completedMinutes: number;  // accumulated in current period
  currentSessionStart?: string | null; // ISO when timing is running
  periodStart: string;  // current period start (week)
  periodEnd: string;    // current period end (week)
}

export type Item = ChecklistItem | TimeItem;

export type ActionType =
  | "create"
  | "update"
  | "archive"
  | "unarchive"
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
  categories: Category[]; // Pre-populated categories
}

// Type guards
export function isChecklistItem(item: Item): item is ChecklistItem {
  return item.tab === "dayToDay" || item.tab === "hitMyGoal";
}

export function isTimeItem(item: Item): item is TimeItem {
  return item.tab === "spendMyTime";
}

// Legacy type guard for backward compatibility
export function isTimeProject(item: Item): item is TimeItem {
  return item.tab === "spendMyTime";
}

// Helper types for forms
export interface RecurrenceFormSettings {
  enabled: boolean;
  frequency: Frequency;
  interval: number; // Repeat every N periods (default 1)
  totalOccurrences: number | null; // null = forever
  timezone: string;
}

export interface ChecklistItemForm {
  title: string;
  categoryId: string;
  dueDate?: string | null; // ISO timestamp for due date (optional)
  recurrence?: RecurrenceFormSettings; // Only for hitMyGoal tab
}

export interface TimeItemForm {
  title: string;
  categoryId: string;
  requiredHours: number;
  requiredMinutes: number;
  dueDate?: string | null; // ISO timestamp for due date (optional)
  recurrence?: RecurrenceFormSettings;
}

export interface ImportOptions {
  mode: 'combine' | 'overwrite';
}

// Swipe action type - what happens on swipe
export type SwipeAction = 'delete' | 'archive';

// Swipe configuration for each tab
export interface SwipeConfig {
  left: SwipeAction;  // What left swipe does
  right: SwipeAction; // What right swipe does
}

// Backup frequency options
export type BackupFrequency = 'never' | 'daily' | 'weekly' | 'monthly';

// Week start day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// App Settings interface
export interface AppSettings {
  // Backup settings
  backupFrequency: BackupFrequency;
  lastBackupDate?: string; // ISO timestamp
  
  // Concurrency settings - allow multiple timers
  allowConcurrentTimers: boolean;
  
  // Week start day (default: Monday = 1)
  weekStartDay: WeekStartDay;
  
  // Swipe motion configuration per tab
  swipeConfig: {
    dayToDay: SwipeConfig;
    hitMyGoal: SwipeConfig;
    spendMyTime: SwipeConfig;
  };
}
