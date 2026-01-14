/**
 * AI Insight Types (v1)
 *
 * These types define the structure for AI-generated insights based on
 * locally computed deterministic stats. The AI only interprets pre-aggregated
 * statistics - it never sees raw action logs.
 */

import { ConfidenceLevel } from '@/lib/types';

// ============================================================================
// Period Types
// ============================================================================

export type PeriodLabel = 'this_week' | 'last_7_days' | `${string}_to_${string}`;

export interface PeriodSpec {
  label: PeriodLabel;
  startISO: string;
  endISO: string;
  timezone: 'America/New_York';
}

// ============================================================================
// Data Quality & Confidence
// ============================================================================

export interface DataQuality {
  hasTimeSessions: boolean;
  hasChecklistData: boolean;
  notes: string[];
  confidenceHint: ConfidenceLevel;
}

// ============================================================================
// Time Tracking Stats (Spend My Time)
// ============================================================================

export interface CategoryMinutes {
  category: string;
  minutes: number;
  ratio: number;
}

export interface DayOfWeekHistogram {
  Mon: number;
  Tue: number;
  Wed: number;
  Thu: number;
  Fri: number;
  Sat: number;
  Sun: number;
}

export interface SessionMetrics {
  totalSessions: number;
  shortSessionRatio: number; // sessions < 15 min / total
  avgSessionMinutes: number;
}

export interface RhythmSignals {
  weekendRatio: number | null; // (Sat+Sun) / total
  lateWeekRatio: number | null; // (Fri+Sat+Sun) / total
  dayTimeRatio: number | null; // 6am-6pm / total
  nightTimeRatio: number | null; // 6pm-6am / total
}

export interface TimeTrackingStats {
  totalTrackedMinutes: number;
  minutesByCategory: Record<string, number>;
  topCategories: CategoryMinutes[]; // max 3
  dayOfWeekHistogram: DayOfWeekHistogram;
  sessionMetrics: SessionMetrics;
  rhythmSignals: RhythmSignals;
}

// ============================================================================
// Project Health Stats
// ============================================================================

export interface ProjectSummary {
  id: string;
  title: string; // truncated to 60 chars
  progress: number; // 0..1
  category: string;
}

export interface ProjectHealthStats {
  liveProjectsCount: number;
  under20ProgressProjects: ProjectSummary[]; // max 3, progress < 0.2
  nearlyDoneProjects: ProjectSummary[]; // max 3, 0.8 <= progress < 1
  projectProgressIsWeekly: boolean; // flag for rolling window caveat
}

// ============================================================================
// Checklist Stats (dayToDay / hitMyGoal)
// ============================================================================

export interface ChecklistTabStats {
  createdCount: number; // items created within period
  completedCount: number; // items completed within period
  completionRate: number | null; // completed/created if created > 0
  staleItems: string[]; // max 5 titles (truncated), unfinished + created > 14 days ago
  totalActiveUnfinished: number; // current count, not period-specific
}

export interface ChecklistStats {
  dayToDay: ChecklistTabStats;
  hitMyGoal: ChecklistTabStats;
}

// ============================================================================
// Full InsightStats (sent to AI)
// ============================================================================

export interface InsightStats {
  statsVersion: 'v1';
  generatedAt: string; // ISO timestamp
  period: PeriodSpec;
  dataQuality: DataQuality;
  
  timeTracking: TimeTrackingStats;
  projectHealth: ProjectHealthStats;
  checklists: ChecklistStats;
}

// ============================================================================
// InsightV1 (AI-generated output)
// ============================================================================

export interface HighlightItem {
  title: string;
  detail?: string;
  metric?: string;
}

export interface PatternItem {
  title: string;
  evidence: string;
  suggestion?: string;
}

export interface FrictionItem {
  title: string;
  evidence: string;
  nudge?: string;
  examples?: string[]; // max 3
}

export interface Encouragement {
  line1: string;
  line2?: string;
}

export interface InsightV1 {
  period: {
    label: string;
    start: string;
    end: string;
    timezone: 'America/New_York';
  };
  
  highlights: HighlightItem[];
  patterns: PatternItem[];
  friction: FrictionItem[];
  
  encouragement: Encouragement;
  
  meta: {
    confidence: ConfidenceLevel;
    notes?: string;
  };
}

// ============================================================================
// Cache Types
// ============================================================================

export interface InsightCache {
  generatedAt: string; // ISO timestamp
  insight: InsightV1;
}

export const INSIGHT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ============================================================================
// API Types
// ============================================================================

export interface InsightAPIRequest {
  stats: InsightStats;
  apiKey?: string; // User-provided API key (sent from client)
  model?: string;  // User-preferred model
}

export interface InsightAPIResponse {
  success: true;
  insight: InsightV1;
}

export interface InsightAPIError {
  success: false;
  error: string;
  code?: string;
}
