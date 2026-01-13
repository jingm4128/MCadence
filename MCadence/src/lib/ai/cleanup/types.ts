/**
 * Clean-up with AI Types
 * 
 * Types for AI-powered cleanup suggestions (archive/delete stale items).
 */

import { TabId, Item } from '@/lib/types';
import { PeriodSpec } from '../insight/types';

// ============================================================================
// Suggestion Types
// ============================================================================

export type CleanupAction = 'archive' | 'delete';

export interface CleanupSuggestion {
  id: string;
  itemId: string;
  itemTitle: string; // Truncated to 60 chars
  itemTab: TabId;
  action: CleanupAction;
  reason: string; // Evidence-based reason
  confidence: number; // 0-1
}

// ============================================================================
// Selection State
// ============================================================================

export interface CleanupSelection {
  id: string;
  selected: boolean;
}

// ============================================================================
// Item Summary (sent to AI, compact)
// ============================================================================

export interface ItemSummary {
  id: string;
  title: string; // Truncated
  tab: TabId;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  // Checklist specific
  isDone?: boolean;
  // Time project specific
  completedMinutes?: number;
  requiredMinutes?: number;
  // Derived metrics
  daysSinceCreated: number;
  daysSinceLastActivity?: number; // Based on action logs or completedAt
  activityCount: number; // Number of actions in period
}

// ============================================================================
// Cleanup Stats (sent to AI)
// ============================================================================

export interface CleanupStats {
  statsVersion: 'v1';
  generatedAt: string;
  period: PeriodSpec;
  
  // Summary counts
  totalItems: number;
  activeItems: number;
  doneItems: number;
  
  // Candidate items for cleanup (pre-filtered)
  staleChecklistItems: ItemSummary[]; // Unfinished, old items
  lowProgressProjects: ItemSummary[]; // Time projects with minimal progress
  longDoneItems: ItemSummary[]; // Done items that could be archived
  inactiveItems: ItemSummary[]; // Items with no recent activity
  
  // Data quality
  dataQuality: {
    hasItems: boolean;
    itemCount: number;
    notes: string[];
  };
}

// ============================================================================
// API Types
// ============================================================================

export interface CleanupAPIRequest {
  stats: CleanupStats;
  apiKey?: string;
  model?: string;
}

export interface CleanupAPIResponse {
  success: true;
  suggestions: CleanupSuggestion[];
}

export interface CleanupAPIError {
  success: false;
  error: string;
  code?: string;
}

// ============================================================================
// Generate Result
// ============================================================================

export interface CleanupResult {
  suggestions: CleanupSuggestion[];
  error?: string;
}
