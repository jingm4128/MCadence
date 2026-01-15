/**
 * Cleanup Generator
 * 
 * Handles generating cleanup suggestions from stats.
 * Supports multiple providers: OpenAI, Gemini, Anthropic.
 */

import {
  CleanupStats,
  CleanupSuggestion,
  CleanupResult,
} from './types';
import {
  getAIRequestConfig,
  isAIEnabled,
  getEffectiveSettings,
} from '../settings';

// ============================================================================
// Check if AI is enabled
// ============================================================================

export function isCleanupEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return isAIEnabled();
}

// ============================================================================
// AI Generator
// ============================================================================

async function fetchAISuggestions(stats: CleanupStats): Promise<CleanupSuggestion[]> {
  const config = getAIRequestConfig();
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Cleanup] AI Config:', {
      provider: config.provider,
      model: config.model,
      hasUserKey: !!config.apiKey,
      useDefaultKey: config.useDefaultKey,
    });
  }
  
  const requestBody: {
    stats: CleanupStats;
    provider?: string;
    apiKey?: string;
    model?: string;
    useDefaultKey?: boolean;
  } = {
    stats,
    provider: config.provider,
    model: config.model,
    useDefaultKey: config.useDefaultKey,
  };
  
  // Include user-provided API key if available
  if (config.apiKey) {
    requestBody.apiKey = config.apiKey;
  }
  
  const response = await fetch('/api/cleanup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success || !data.suggestions) {
    throw new Error('Invalid API response');
  }
  
  return data.suggestions;
}

// ============================================================================
// Main Generate Function
// ============================================================================

export async function generateCleanupSuggestions(
  stats: CleanupStats
): Promise<CleanupResult> {
  // Check if there are any candidates
  const totalCandidates = 
    stats.staleChecklistItems.length +
    stats.lowProgressProjects.length +
    stats.longDoneItems.length +
    stats.inactiveItems.length;
  
  if (totalCandidates === 0) {
    return { 
      suggestions: [],
      error: undefined,
    };
  }
  
  // AI is required for cleanup suggestions - no deterministic fallback
  if (!isCleanupEnabled()) {
    const effective = getEffectiveSettings();
    return {
      suggestions: [],
      error: `AI is not enabled. Please configure your ${effective.provider} API key to use cleanup suggestions.`,
    };
  }
  
  try {
    const suggestions = await fetchAISuggestions(stats);
    return { suggestions };
  } catch (error) {
    return {
      suggestions: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
