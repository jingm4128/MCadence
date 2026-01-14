/**
 * Quick Add with AI Types
 *
 * Types for parsing user text into structured item proposals.
 * Uses centralized types from lib/types.ts for consistency.
 */

import { TabId } from '@/lib/types';

// ============================================================================
// Tab Types
// ============================================================================

// QuickAddTab is now an alias for TabId for backward compatibility
export type QuickAddTab = TabId;

// ============================================================================
// Recurrence Types
// QuickAdd uses a subset of RecurrenceType (excludes 'annually')
// ============================================================================

export type RecurrenceType = 'one_off' | 'daily' | 'weekly' | 'monthly';

// ============================================================================
// Proposal Types
// ============================================================================

export type ProposalType = 'task' | 'goal' | 'time_project';

export interface QuickAddProposal {
  id: string;
  type: ProposalType;
  tab: QuickAddTab;
  title: string;
  categoryId: string;
  categoryName?: string; // For display purposes
  confidence: number; // 0-1, how confident AI is about this proposal
  reason?: string; // Why AI thinks this should be added
  
  // Recurrence (for time projects or recurring tasks)
  recurrence: RecurrenceType;
  
  // Time/duration fields (for time projects)
  durationMinutes?: number; // Per-session duration in minutes
  frequencyPerWeek?: number; // How many times per week (for daily/weekly recurrence)
  requiredMinutes?: number; // Total weekly time requirement (computed or specified)
}

// ============================================================================
// Selection State
// ============================================================================

export interface ProposalSelection {
  id: string;
  selected: boolean;
  // Edited values (if user changed them)
  editedTitle?: string;
  editedTab?: QuickAddTab;
  editedCategoryId?: string;
  editedRecurrence?: RecurrenceType;
  editedDurationMinutes?: number;
  editedFrequencyPerWeek?: number;
  editedRequiredMinutes?: number; // For time projects
  editedTotalOccurrences?: number; // For hitMyGoal recurring items
}

// ============================================================================
// API Types
// ============================================================================

export interface CategoryPalette {
  id: string;
  name: string;
  icon?: string;
  subcategories: {
    id: string;
    name: string;
    icon?: string;
  }[];
}

export interface QuickAddAPIRequest {
  text: string;
  categories: CategoryPalette[];
  apiKey?: string;
  model?: string;
}

export interface QuickAddAPIResponse {
  success: true;
  proposals: QuickAddProposal[];
}

export interface QuickAddAPIError {
  success: false;
  error: string;
  code?: string;
}

// ============================================================================
// Generate Result
// ============================================================================

export interface QuickAddResult {
  proposals: QuickAddProposal[];
  error?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isChecklistProposal(proposal: QuickAddProposal): boolean {
  return proposal.tab === 'dayToDay' || proposal.tab === 'hitMyGoal';
}

export function isTimeProjectProposal(proposal: QuickAddProposal): boolean {
  return proposal.tab === 'spendMyTime';
}

// ============================================================================
// Helper to get TabId from ProposalType
// ============================================================================

export function getTabIdFromProposalType(type: ProposalType): TabId {
  switch (type) {
    case 'task':
      return 'dayToDay';
    case 'goal':
      return 'hitMyGoal';
    case 'time_project':
      return 'spendMyTime';
  }
}

// ============================================================================
// Helper to get default type from tab
// ============================================================================

export function getDefaultTypeFromTab(tab: QuickAddTab): ProposalType {
  switch (tab) {
    case 'dayToDay':
      return 'task';
    case 'hitMyGoal':
      return 'goal';
    case 'spendMyTime':
      return 'time_project';
  }
}

// ============================================================================
// Helper to compute weekly minutes from recurrence
// ============================================================================

export function computeWeeklyMinutes(
  durationMinutes: number,
  recurrence: RecurrenceType,
  frequencyPerWeek?: number
): number {
  switch (recurrence) {
    case 'daily':
      return durationMinutes * 7;
    case 'weekly':
      return durationMinutes * (frequencyPerWeek || 1);
    case 'monthly':
      // Approximate: 4.33 weeks per month
      return Math.round(durationMinutes / 4.33);
    case 'one_off':
      return durationMinutes;
  }
}

// ============================================================================
// Tab Labels
// ============================================================================

export const TAB_LABELS: Record<QuickAddTab, string> = {
  dayToDay: 'Day to Day',
  hitMyGoal: 'Hit My Goal',
  spendMyTime: 'Spend My Time',
};

export const TAB_ICONS: Record<QuickAddTab, string> = {
  dayToDay: '📝',
  hitMyGoal: '🎯',
  spendMyTime: '⏱️',
};

// ============================================================================
// Recurrence Labels
// ============================================================================

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  one_off: 'One-off',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};
