/**
 * Shared AI Types
 * 
 * Common types used across AI features (Quick Add, Clean-up, etc.)
 */

// ============================================================================
// Common Types
// ============================================================================

export type ConfidenceLevel = 'low' | 'medium' | 'high';

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
