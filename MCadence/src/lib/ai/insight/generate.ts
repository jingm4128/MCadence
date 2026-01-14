/**
 * Insight Generator (v1)
 *
 * Handles insight generation with:
 * - Real mode: Calls the API route to get AI-generated insights
 * - Caching: 15-minute TTL for generated insights
 * - Multi-provider support: OpenAI, Gemini, Anthropic
 */

import {
  InsightStats,
  InsightV1,
  InsightCache,
  PeriodSpec,
  INSIGHT_CACHE_TTL_MS,
} from './types';
import {
  getEffectiveSettings,
  getAIRequestConfig,
  isAIEnabled as checkAIEnabled,
  getAISource as checkAISource,
} from '../settings';

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Generate cache key for a period.
 */
function getCacheKey(period: PeriodSpec): string {
  return `mcadence_insight_v1_${period.label}_${period.startISO}_${period.endISO}`;
}

/**
 * Get cached insight if valid.
 */
export function getCachedInsight(period: PeriodSpec): InsightV1 | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = getCacheKey(period);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const data: InsightCache = JSON.parse(cached);
    const cacheAge = Date.now() - new Date(data.generatedAt).getTime();
    
    if (cacheAge < INSIGHT_CACHE_TTL_MS) {
      return data.insight;
    }
    
    // Cache expired, remove it
    localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

/**
 * Save insight to cache.
 */
export function setCachedInsight(period: PeriodSpec, insight: InsightV1): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = getCacheKey(period);
    const cache: InsightCache = {
      generatedAt: new Date().toISOString(),
      insight,
    };
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // Ignore cache errors
  }
}

/**
 * Clear cached insight for a period.
 */
export function clearCachedInsight(period: PeriodSpec): void {
  if (typeof window === 'undefined') return;
  
  try {
    const key = getCacheKey(period);
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// AI Insight Generator
// ============================================================================

/**
 * Check if AI is enabled.
 * Priority:
 * 1. User-configured API key in localStorage
 * 2. Environment variable (default key)
 */
export function isAIEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return checkAIEnabled();
}

/**
 * Get the source of AI configuration.
 */
export function getAISource(): 'user' | 'env' | 'none' {
  if (typeof window === 'undefined') return 'none';
  return checkAISource();
}

/**
 * Call the API route to generate AI insight.
 */
async function fetchAIInsight(stats: InsightStats): Promise<InsightV1> {
  const config = getAIRequestConfig();
  
  const requestBody: {
    stats: InsightStats;
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
  
  const response = await fetch('/api/insight', {
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
  
  if (!data.success || !data.insight) {
    throw new Error('Invalid API response');
  }
  
  return data.insight;
}

// ============================================================================
// Main Generate Function
// ============================================================================

export interface GenerateInsightOptions {
  forceRefresh?: boolean;
}

export interface GenerateInsightResult {
  insight: InsightV1;
  fromCache: boolean;
  error?: string;
}

/**
 * Generate insight for a period.
 *
 * - Checks cache first (unless forceRefresh)
 * - Calls API route to get AI-generated insights
 * - Caches the result
 * - Throws error if AI is not enabled or API fails
 */
export async function generateInsight(
  stats: InsightStats,
  options: GenerateInsightOptions = {}
): Promise<GenerateInsightResult> {
  const { forceRefresh = false } = options;
  
  // Check if AI is enabled
  if (!isAIEnabled()) {
    const effective = getEffectiveSettings();
    throw new Error(`AI is not enabled. Please configure your ${effective.provider} API key in settings.`);
  }
  
  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedInsight(stats.period);
    if (cached) {
      return { insight: cached, fromCache: true };
    }
  }
  
  // Call AI API
  const insight = await fetchAIInsight(stats);
  
  // Cache the result
  setCachedInsight(stats.period, insight);
  
  return { insight, fromCache: false };
}
