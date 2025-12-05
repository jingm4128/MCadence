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

// Type guards
export function isChecklistItem(item: Item): item is ChecklistItem {
  return item.tab === "dayToDay" || item.tab === "hitMyGoal";
}

export function isTimeProject(item: Item): item is TimeProject {
  return item.tab === "spendMyTime";
}

// Helper types for forms
export interface ChecklistItemForm {
  title: string;
  category: string;
  color: string;
}

export interface TimeProjectForm {
  title: string;
  category: string;
  color: string;
  requiredHours: number;
  requiredMinutes: number;
}

export interface ImportOptions {
  mode: 'combine' | 'overwrite';
}
