/**
 * Shared AI Utilities
 * 
 * Common helper functions used across AI features.
 * Consolidates duplicate code from insight, cleanup, and quickadd modules.
 */

// ============================================================================
// Constants
// ============================================================================

export const MAX_REQUEST_SIZE = 50 * 1024; // 50KB max request size
export const MAX_TITLE_LENGTH = 60;

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate a string to max length with ellipsis.
 * Used across insight/stats, cleanup/stats for item titles.
 */
export function truncateTitle(title: string, maxLen: number = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 3) + '...';
}

// ============================================================================
// JSON Extraction
// ============================================================================

/**
 * Extract JSON object from AI response text.
 * Handles cases where AI might include markdown or extra text.
 * Used by all AI API routes (insight, cleanup, quickadd).
 */
export function extractJSONFromText<T>(text: string): T {
  // First, try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No valid JSON found in response');
  }
}

// ============================================================================
// Error Status Code Mapping
// ============================================================================

/**
 * Determine appropriate HTTP status code based on error message.
 * Used by all AI API routes for consistent error handling.
 */
export function getErrorStatusCode(errorMessage: string): number {
  if (errorMessage.includes('Invalid API key') || errorMessage.includes('API key')) {
    return 401;
  } else if (errorMessage.includes('Rate limit')) {
    return 429;
  } else if (errorMessage.includes('Billing') || errorMessage.includes('permission')) {
    return 402;
  }
  return 500;
}

// ============================================================================
// Numeric Utilities
// ============================================================================

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
