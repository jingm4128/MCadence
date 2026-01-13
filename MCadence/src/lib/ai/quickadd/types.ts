/**
 * Quick Add with AI Types
 * 
 * Types for parsing user text into structured item proposals.
 */

import { TabId } from '@/lib/types';

// ============================================================================
// Proposal Types
// ============================================================================

export type ProposalType = 'task' | 'goal' | 'time_project';

export interface BaseProposal {
  id: string;
  type: ProposalType;
  title: string;
  categoryId: string;
  categoryName?: string; // For display purposes
  confidence: number; // 0-1, how confident AI is about this proposal
  reason?: string; // Why AI thinks this should be added
}

export interface ChecklistProposal extends BaseProposal {
  type: 'task' | 'goal';
  tab: 'dayToDay' | 'hitMyGoal';
}

export interface TimeProjectProposal extends BaseProposal {
  type: 'time_project';
  tab: 'spendMyTime';
  requiredMinutes: number; // Default weekly time requirement
}

export type QuickAddProposal = ChecklistProposal | TimeProjectProposal;

// ============================================================================
// Selection State
// ============================================================================

export interface ProposalSelection {
  id: string;
  selected: boolean;
  // Edited values (if user changed them)
  editedTitle?: string;
  editedCategoryId?: string;
  editedRequiredMinutes?: number; // For time projects
}

// ============================================================================
// API Types
// ============================================================================

export interface CategoryPalette {
  id: string;
  name: string;
  subcategories: {
    id: string;
    name: string;
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

export function isChecklistProposal(proposal: QuickAddProposal): proposal is ChecklistProposal {
  return proposal.type === 'task' || proposal.type === 'goal';
}

export function isTimeProjectProposal(proposal: QuickAddProposal): proposal is TimeProjectProposal {
  return proposal.type === 'time_project';
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
