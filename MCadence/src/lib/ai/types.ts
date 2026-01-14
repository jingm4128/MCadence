/**
 * Shared AI Types
 *
 * Common types used across AI features (Quick Add, Clean-up, etc.)
 * Re-exports common types from lib/types.ts for backward compatibility.
 */

// Re-export common types from central types file
export type { ConfidenceLevel, RecurrenceType } from '@/lib/types';
import type { ConfidenceLevel } from '@/lib/types';

// ============================================================================
// Common Types
// ============================================================================

export interface AIResultMeta {
  confidence: ConfidenceLevel;
  notes?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AIAPISuccessResponse<T> {
  success: true;
  data: T;
}

export interface AIAPIErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type AIAPIResponse<T> = AIAPISuccessResponse<T> | AIAPIErrorResponse;

// ============================================================================
// AI Disabled Error
// ============================================================================

export class AIDisabledError extends Error {
  constructor(message = 'AI features are currently disabled. Please configure your API key in AI Settings.') {
    super(message);
    this.name = 'AIDisabledError';
  }
}
