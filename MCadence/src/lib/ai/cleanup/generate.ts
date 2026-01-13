/**
 * Cleanup Generator
 * 
 * Handles generating cleanup suggestions from stats.
 */

import {
  CleanupStats,
  CleanupSuggestion,
  CleanupResult,
} from './types';
import { loadAISettings, isUserAIEnabled } from '../insight/settings';

// ============================================================================
// Check if AI is enabled
// ============================================================================

export function isCleanupEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check user-configured settings first
  if (isUserAIEnabled()) {
    return true;
  }
  
  // Fallback to environment variable
  return process.env.NEXT_PUBLIC_AI_ENABLED === 'true';
}

// ============================================================================
// AI Generator
// ============================================================================

async function fetchAISuggestions(stats: CleanupStats): Promise<CleanupSuggestion[]> {
  const settings = loadAISettings();
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Cleanup] Settings loaded:', {
      hasApiKey: !!settings.apiKey,
      apiKeyPrefix: settings.apiKey ? settings.apiKey.slice(0, 10) + '...' : 'none',
      enabled: settings.enabled,
      model: settings.model,
    });
  }
  
  const requestBody: {
    stats: CleanupStats;
    apiKey?: string;
    model?: string;
  } = {
    stats,
  };
  
  // Include user-provided API key if available
  if (settings.apiKey && settings.enabled) {
    requestBody.apiKey = settings.apiKey;
    if (settings.model) {
      requestBody.model = settings.model;
    }
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
    return {
      suggestions: [],
      error: 'AI is not enabled. Please configure your API key to use cleanup suggestions.',
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
