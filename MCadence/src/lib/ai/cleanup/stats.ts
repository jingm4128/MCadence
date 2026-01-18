/**
 * Cleanup Stats Builder
 *
 * Builds compact item summaries for AI cleanup analysis.
 * Reuses date utilities from insight module.
 */

import {
  CleanupStats,
  ItemSummary,
} from './types';
import { PeriodSpec } from '../insight/types';
import { truncateTitle } from '../utils';

import { AppState, Item, isChecklistItem, isTimeItem } from '@/lib/types';
import { ITEM_STATUS } from '@/lib/constants';
import {
  getNowNY,
  getDaysDiffFromNow,
  isInPeriod,
} from '@/utils/date';

// ============================================================================
// Constants
// ============================================================================

const MAX_ITEMS_PER_CATEGORY = 20;
const STALE_DAYS_THRESHOLD = 14;
const LOW_PROGRESS_THRESHOLD = 0.1; // 10% or less
const DONE_DAYS_THRESHOLD = 30; // Done items older than 30 days
const INACTIVE_DAYS_THRESHOLD = 21; // No activity in 21 days

function getLastActivityDate(item: Item, actions: AppState['actions']): Date | null {
  // Get most recent action for this item
  const itemActions = actions
    .filter(a => a.itemId === item.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  if (itemActions.length > 0) {
    return new Date(itemActions[0].timestamp);
  }
  
  // Fallback to completedAt for checklist items
  if (isChecklistItem(item) && item.completedAt) {
    return new Date(item.completedAt);
  }
  
  // Fallback to updatedAt
  return new Date(item.updatedAt);
}

function countActionsInPeriod(
  itemId: string,
  actions: AppState['actions'],
  period: PeriodSpec
): number {
  return actions.filter(
    a => a.itemId === itemId && isInPeriod(a.timestamp, period.startISO, period.endISO)
  ).length;
}

// ============================================================================
// Item Summary Builder
// ============================================================================

function buildItemSummary(
  item: Item,
  actions: AppState['actions'],
  period: PeriodSpec
): ItemSummary {
  const now = getNowNY();
  const createdDate = new Date(item.createdAt);
  const lastActivity = getLastActivityDate(item, actions);
  
  const daysSinceCreated = getDaysDiffFromNow(item.createdAt);
  const daysSinceLastActivity = lastActivity
    ? Math.floor((now.toDate().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
    : daysSinceCreated;
  
  const activityCount = countActionsInPeriod(item.id, actions, period);
  
  const base: ItemSummary = {
    id: item.id,
    title: truncateTitle(item.title),
    tab: item.tab,
    status: item.status,
    createdAt: item.createdAt,
    daysSinceCreated,
    daysSinceLastActivity,
    activityCount,
  };
  
  if (isChecklistItem(item)) {
    return {
      ...base,
      isDone: item.isDone,
      completedAt: item.completedAt,
    };
  }
  
  if (isTimeItem(item)) {
    return {
      ...base,
      completedMinutes: item.completedMinutes,
      requiredMinutes: item.requiredMinutes,
    };
  }
  
  return base;
}

// ============================================================================
// Candidate Filters
// ============================================================================

/**
 * Get stale checklist items (unfinished, old).
 */
function getStaleChecklistItems(
  items: Item[],
  actions: AppState['actions'],
  period: PeriodSpec
): ItemSummary[] {
  return items
    .filter(item => 
      isChecklistItem(item) &&
      !item.isDone &&
      item.status === ITEM_STATUS.ACTIVE &&
      getDaysDiffFromNow(item.createdAt) > STALE_DAYS_THRESHOLD
    )
    .map(item => buildItemSummary(item, actions, period))
    .sort((a, b) => b.daysSinceCreated - a.daysSinceCreated)
    .slice(0, MAX_ITEMS_PER_CATEGORY);
}

/**
 * Get time projects with low progress.
 */
function getLowProgressProjects(
  items: Item[],
  actions: AppState['actions'],
  period: PeriodSpec
): ItemSummary[] {
  return items
    .filter(item => {
      if (!isTimeItem(item)) return false;
      if (item.status !== ITEM_STATUS.ACTIVE) return false;
      if (item.requiredMinutes === 0) return false;
      
      const progress = item.completedMinutes / item.requiredMinutes;
      return progress <= LOW_PROGRESS_THRESHOLD;
    })
    .map(item => buildItemSummary(item, actions, period))
    .sort((a, b) => {
      // Sort by progress (lowest first)
      const progressA = (a.completedMinutes || 0) / (a.requiredMinutes || 1);
      const progressB = (b.completedMinutes || 0) / (b.requiredMinutes || 1);
      return progressA - progressB;
    })
    .slice(0, MAX_ITEMS_PER_CATEGORY);
}

/**
 * Get done items that could be archived.
 */
function getLongDoneItems(
  items: Item[],
  actions: AppState['actions'],
  period: PeriodSpec
): ItemSummary[] {
  return items
    .filter(item => {
      if (item.status !== ITEM_STATUS.DONE) return false;
      
      if (isChecklistItem(item) && item.completedAt) {
        const daysSinceCompleted = getDaysDiffFromNow(item.completedAt);
        return daysSinceCompleted > DONE_DAYS_THRESHOLD;
      }
      
      return false;
    })
    .map(item => buildItemSummary(item, actions, period))
    .sort((a, b) => {
      const daysA = a.completedAt ? getDaysDiffFromNow(a.completedAt) : 0;
      const daysB = b.completedAt ? getDaysDiffFromNow(b.completedAt) : 0;
      return daysB - daysA;
    })
    .slice(0, MAX_ITEMS_PER_CATEGORY);
}

/**
 * Get items with no recent activity.
 */
function getInactiveItems(
  items: Item[],
  actions: AppState['actions'],
  period: PeriodSpec
): ItemSummary[] {
  return items
    .filter(item => item.status === ITEM_STATUS.ACTIVE)
    .map(item => buildItemSummary(item, actions, period))
    .filter(summary => 
      summary.daysSinceLastActivity !== undefined &&
      summary.daysSinceLastActivity > INACTIVE_DAYS_THRESHOLD
    )
    .sort((a, b) => (b.daysSinceLastActivity || 0) - (a.daysSinceLastActivity || 0))
    .slice(0, MAX_ITEMS_PER_CATEGORY);
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build cleanup stats from app state for a given period.
 */
export function buildCleanupStats(period: PeriodSpec, state: AppState): CleanupStats {
  const notes: string[] = [];
  
  // Filter out already archived items
  const relevantItems = state.items.filter(item => !item.isArchived);
  
  // Count by status
  const activeItems = relevantItems.filter(item => item.status === ITEM_STATUS.ACTIVE).length;
  const doneItems = relevantItems.filter(item => item.status === ITEM_STATUS.DONE).length;
  
  // Build candidate lists
  const staleChecklistItems = getStaleChecklistItems(relevantItems, state.actions, period);
  const lowProgressProjects = getLowProgressProjects(relevantItems, state.actions, period);
  const longDoneItems = getLongDoneItems(relevantItems, state.actions, period);
  const inactiveItems = getInactiveItems(relevantItems, state.actions, period);
  
  // Data quality assessment
  const hasItems = relevantItems.length > 0;
  const totalCandidates = staleChecklistItems.length + lowProgressProjects.length + 
                          longDoneItems.length + inactiveItems.length;
  
  if (!hasItems) {
    notes.push('No items found to analyze.');
  } else if (totalCandidates === 0) {
    notes.push('No cleanup candidates found - your lists look well-maintained!');
  }
  
  return {
    statsVersion: 'v1',
    generatedAt: getNowNY().toISOString(),
    period,
    
    totalItems: relevantItems.length,
    activeItems,
    doneItems,
    
    staleChecklistItems,
    lowProgressProjects,
    longDoneItems,
    inactiveItems,
    
    dataQuality: {
      hasItems,
      itemCount: relevantItems.length,
      notes,
    },
  };
}
