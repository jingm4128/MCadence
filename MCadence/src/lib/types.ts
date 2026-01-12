export type TabId = "dayToDay" | "hitMyGoal" | "spendMyTime";

export type ItemStatus = "active" | "done" | "archived";

export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "annually";

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
  occurrences: number; // Number of times to repeat
  isEnabled: boolean;
  nextDue?: string; // EST timestamp
}

export interface BaseItem {
  id: string; // uuid
  tab: TabId;
  title: string;
  categoryId: string; // Reference to subcategory
  sortKey: number;   // for ordering within tab
  status: ItemStatus;
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
  archivedAt?: string | null;
  recurrence?: RecurrenceSettings; // For recurring items
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

// Export default categories for use in other files
export const DEFAULT_CATEGORIES: Category[] = [
  // This will be imported from constants
];

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
export interface ChecklistItemForm {
  title: string;
  categoryId: string;
}

export interface TimeItemForm {
  title: string;
  categoryId: string;
  requiredHours: number;
  requiredMinutes: number;
}

export interface ImportOptions {
  mode: 'combine' | 'overwrite';
}
