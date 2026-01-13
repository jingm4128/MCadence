/**
 * Insight Stats Builder (v1)
 * 
 * Computes deterministic, aggregated statistics from app state.
 * This data is what gets sent to the AI - never raw action logs.
 */

import {
  PeriodSpec,
  InsightStats,
  DataQuality,
  ConfidenceLevel,
  TimeTrackingStats,
  DayOfWeekHistogram,
  SessionMetrics,
  RhythmSignals,
  CategoryMinutes,
  ProjectHealthStats,
  ProjectSummary,
  ChecklistStats,
  ChecklistTabStats,
} from './types';

import { AppState, ActionLog, Item, TimeItem, ChecklistItem, isTimeItem, isChecklistItem } from '@/lib/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import {
  isInPeriod,
  getDayOfWeekNY,
  isDayTimeNY,
  getMinutesDiff,
  isOlderThanDaysNY,
  getNowNY,
} from '@/utils/date';

// ============================================================================
// Constants
// ============================================================================

const MAX_TOP_CATEGORIES = 3;
const MAX_PROJECT_LIST = 3;
const MAX_STALE_ITEMS = 5;
const MAX_TITLE_LENGTH = 60;
const STALE_DAYS_THRESHOLD = 14;
const SHORT_SESSION_MINUTES = 15;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate a string to max length with ellipsis.
 */
function truncateTitle(title: string, maxLen: number = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 3) + '...';
}

/**
 * Get category name from subcategory ID.
 */
function getCategoryName(categoryId: string, categories: AppState['categories']): string {
  const cats = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  
  for (const cat of cats) {
    const sub = cat.subcategories.find(s => s.id === categoryId);
    if (sub) {
      return cat.name;
    }
  }
  return 'Uncategorized';
}

/**
 * Initialize empty day-of-week histogram.
 */
function initDayOfWeekHistogram(): DayOfWeekHistogram {
  return { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
}

/**
 * Map JS day number (0=Sun) to histogram key.
 */
function dayNumberToKey(day: number): keyof DayOfWeekHistogram {
  const map: Record<number, keyof DayOfWeekHistogram> = {
    0: 'Sun',
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
  };
  return map[day] || 'Mon';
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Time Tracking Stats
// ============================================================================

interface TimerSession {
  itemId: string;
  stopTimestamp: string;
  durationMinutes: number;
  categoryId: string;
}

/**
 * Extract timer sessions from action logs within period.
 */
function extractTimerSessions(
  actions: ActionLog[],
  items: Item[],
  period: PeriodSpec,
  notes: string[]
): TimerSession[] {
  const sessions: TimerSession[] = [];
  
  // Filter for timer_stop actions within the period
  const timerStopActions = actions.filter(
    a => a.type === 'timer_stop' && isInPeriod(a.timestamp, period.startISO, period.endISO)
  );
  
  for (const action of timerStopActions) {
    const item = items.find(i => i.id === action.itemId);
    
    // Try to get duration from payload
    let durationMinutes: number | null = null;
    
    if (action.payload?.durationMinutes !== undefined) {
      durationMinutes = action.payload.durationMinutes;
    } else if (action.payload?.startISO && action.payload?.endISO) {
      durationMinutes = getMinutesDiff(action.payload.startISO, action.payload.endISO);
    }
    
    if (durationMinutes === null || durationMinutes <= 0) {
      notes.push(`Session ${action.id.slice(0, 8)} missing duration data`);
      continue;
    }
    
    sessions.push({
      itemId: action.itemId,
      stopTimestamp: action.timestamp,
      durationMinutes,
      categoryId: item?.categoryId || '',
    });
  }
  
  return sessions;
}

/**
 * Build time tracking statistics.
 */
function buildTimeTrackingStats(
  sessions: TimerSession[],
  categories: AppState['categories']
): TimeTrackingStats {
  const minutesByCategory: Record<string, number> = {};
  const histogram = initDayOfWeekHistogram();
  let totalMinutes = 0;
  let dayTimeMinutes = 0;
  let nightTimeMinutes = 0;
  let shortSessions = 0;
  
  for (const session of sessions) {
    const { durationMinutes, categoryId, stopTimestamp } = session;
    
    // Total
    totalMinutes += durationMinutes;
    
    // By category
    const catName = getCategoryName(categoryId, categories);
    minutesByCategory[catName] = (minutesByCategory[catName] || 0) + durationMinutes;
    
    // Day of week
    const dow = getDayOfWeekNY(stopTimestamp);
    const dowKey = dayNumberToKey(dow);
    histogram[dowKey] += durationMinutes;
    
    // Day/night
    if (isDayTimeNY(stopTimestamp)) {
      dayTimeMinutes += durationMinutes;
    } else {
      nightTimeMinutes += durationMinutes;
    }
    
    // Short sessions
    if (durationMinutes < SHORT_SESSION_MINUTES) {
      shortSessions++;
    }
  }
  
  // Top categories
  const catEntries = Object.entries(minutesByCategory)
    .map(([category, minutes]) => ({
      category,
      minutes,
      ratio: totalMinutes > 0 ? minutes / totalMinutes : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, MAX_TOP_CATEGORIES);
  
  // Session metrics
  const sessionMetrics: SessionMetrics = {
    totalSessions: sessions.length,
    shortSessionRatio: sessions.length > 0 ? shortSessions / sessions.length : 0,
    avgSessionMinutes: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
  };
  
  // Rhythm signals
  const weekendMinutes = histogram.Sat + histogram.Sun;
  const lateWeekMinutes = histogram.Fri + histogram.Sat + histogram.Sun;
  
  const rhythmSignals: RhythmSignals = {
    weekendRatio: totalMinutes > 0 ? weekendMinutes / totalMinutes : null,
    lateWeekRatio: totalMinutes > 0 ? lateWeekMinutes / totalMinutes : null,
    dayTimeRatio: totalMinutes > 0 ? dayTimeMinutes / totalMinutes : null,
    nightTimeRatio: totalMinutes > 0 ? nightTimeMinutes / totalMinutes : null,
  };
  
  return {
    totalTrackedMinutes: totalMinutes,
    minutesByCategory,
    topCategories: catEntries,
    dayOfWeekHistogram: histogram,
    sessionMetrics,
    rhythmSignals,
  };
}

// ============================================================================
// Project Health Stats
// ============================================================================

/**
 * Check if a project is "live" in the period.
 * Live = createdAt < period.endISO AND (archivedAt is null OR archivedAt >= period.startISO)
 */
function isProjectLiveInPeriod(item: TimeItem, period: PeriodSpec): boolean {
  if (new Date(item.createdAt) >= new Date(period.endISO)) {
    return false;
  }
  if (item.archivedAt && new Date(item.archivedAt) < new Date(period.startISO)) {
    return false;
  }
  return true;
}

/**
 * Build project health statistics.
 */
function buildProjectHealthStats(
  items: Item[],
  period: PeriodSpec,
  categories: AppState['categories'],
  notes: string[]
): ProjectHealthStats {
  const timeItems = items.filter(isTimeItem);
  const liveProjects = timeItems.filter(item => isProjectLiveInPeriod(item, period));
  
  // Calculate progress for each project
  const projectsWithProgress: (ProjectSummary & { progress: number })[] = liveProjects.map(item => ({
    id: item.id,
    title: truncateTitle(item.title),
    progress: item.requiredMinutes > 0 
      ? clamp(item.completedMinutes / item.requiredMinutes, 0, 1)
      : 0,
    category: getCategoryName(item.categoryId, categories),
  }));
  
  // Under 20% progress
  const under20 = projectsWithProgress
    .filter(p => p.progress < 0.2)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, MAX_PROJECT_LIST);
  
  // Nearly done (80% - 100%)
  const nearlyDone = projectsWithProgress
    .filter(p => p.progress >= 0.8 && p.progress < 1)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, MAX_PROJECT_LIST);
  
  // Add note for rolling window caveat
  const isRollingWindow = period.label === 'last_7_days';
  if (isRollingWindow) {
    notes.push('Project progress uses current weekly totals; last_7_days is a rolling window.');
  }
  
  return {
    liveProjectsCount: liveProjects.length,
    under20ProgressProjects: under20,
    nearlyDoneProjects: nearlyDone,
    projectProgressIsWeekly: true, // Progress is always based on weekly fields
  };
}

// ============================================================================
// Checklist Stats
// ============================================================================

/**
 * Build stats for a single checklist tab.
 */
function buildChecklistTabStats(
  items: Item[],
  tab: 'dayToDay' | 'hitMyGoal',
  period: PeriodSpec
): ChecklistTabStats {
  const checklistItems = items.filter(
    (item): item is ChecklistItem => isChecklistItem(item) && item.tab === tab
  );
  
  // Items created within period
  const createdInPeriod = checklistItems.filter(
    item => isInPeriod(item.createdAt, period.startISO, period.endISO)
  );
  
  // Items completed within period
  const completedInPeriod = checklistItems.filter(
    item => item.completedAt && isInPeriod(item.completedAt, period.startISO, period.endISO)
  );
  
  // Stale items: unfinished, not archived, created > 14 days ago
  const staleItems = checklistItems
    .filter(item => 
      !item.isDone &&
      item.status !== 'archived' &&
      isOlderThanDaysNY(item.createdAt, STALE_DAYS_THRESHOLD)
    )
    .slice(0, MAX_STALE_ITEMS)
    .map(item => truncateTitle(item.title));
  
  // Active unfinished (current state, not period-specific)
  const totalActiveUnfinished = checklistItems.filter(
    item => !item.isDone && item.status === 'active'
  ).length;
  
  const createdCount = createdInPeriod.length;
  const completedCount = completedInPeriod.length;
  
  return {
    createdCount,
    completedCount,
    completionRate: createdCount > 0 ? completedCount / createdCount : null,
    staleItems,
    totalActiveUnfinished,
  };
}

/**
 * Build stats for all checklist tabs.
 */
function buildChecklistStats(items: Item[], period: PeriodSpec): ChecklistStats {
  return {
    dayToDay: buildChecklistTabStats(items, 'dayToDay', period),
    hitMyGoal: buildChecklistTabStats(items, 'hitMyGoal', period),
  };
}

// ============================================================================
// Data Quality Assessment
// ============================================================================

/**
 * Assess data quality and confidence level.
 */
function assessDataQuality(
  stats: {
    timeTracking: TimeTrackingStats;
    checklists: ChecklistStats;
    projectHealth: ProjectHealthStats;
  },
  notes: string[]
): DataQuality {
  const hasTimeSessions = stats.timeTracking.sessionMetrics.totalSessions > 0;
  const hasChecklistData = 
    stats.checklists.dayToDay.createdCount > 0 ||
    stats.checklists.dayToDay.completedCount > 0 ||
    stats.checklists.hitMyGoal.createdCount > 0 ||
    stats.checklists.hitMyGoal.completedCount > 0;
  
  // Determine confidence
  let confidenceHint: ConfidenceLevel;
  
  if (!hasTimeSessions && !hasChecklistData) {
    confidenceHint = 'low';
    notes.push('No time sessions or checklist activity found in period.');
  } else if (hasTimeSessions && hasChecklistData) {
    confidenceHint = 'high';
  } else {
    confidenceHint = 'medium';
    if (!hasTimeSessions) {
      notes.push('No time tracking sessions in period; insights based on checklist data only.');
    }
    if (!hasChecklistData) {
      notes.push('No checklist activity in period; insights based on time tracking only.');
    }
  }
  
  return {
    hasTimeSessions,
    hasChecklistData,
    notes,
    confidenceHint,
  };
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build complete insight stats from app state for a given period.
 * This is the main entry point.
 */
export function buildInsightStats(period: PeriodSpec, state: AppState): InsightStats {
  const notes: string[] = [];
  
  // Extract timer sessions
  const sessions = extractTimerSessions(state.actions, state.items, period, notes);
  
  // Build individual stat sections
  const timeTracking = buildTimeTrackingStats(sessions, state.categories);
  const projectHealth = buildProjectHealthStats(state.items, period, state.categories, notes);
  const checklists = buildChecklistStats(state.items, period);
  
  // Assess data quality
  const dataQuality = assessDataQuality({ timeTracking, checklists, projectHealth }, notes);
  
  return {
    statsVersion: 'v1',
    generatedAt: getNowNY().toISOString(),
    period,
    dataQuality,
    timeTracking,
    projectHealth,
    checklists,
  };
}
