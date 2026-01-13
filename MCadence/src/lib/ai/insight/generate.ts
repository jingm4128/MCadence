/**
 * Insight Generator (v1)
 *
 * Handles insight generation with:
 * - Mock mode (when AI is disabled): Generates deterministic insights from stats
 * - Real mode: Calls the API route to get AI-generated insights
 * - Caching: 15-minute TTL for generated insights
 */

import {
  InsightStats,
  InsightV1,
  InsightCache,
  PeriodSpec,
  INSIGHT_CACHE_TTL_MS,
} from './types';
import { formatMinutes } from '@/utils/date';
import { loadAISettings, isUserAIEnabled } from './settings';

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
// Mock Insight Generator
// ============================================================================

/**
 * Generate a deterministic mock insight from stats.
 * Used when AI is disabled (NEXT_PUBLIC_AI_ENABLED !== "true").
 */
export function generateMockInsight(stats: InsightStats): InsightV1 {
  const { timeTracking, projectHealth, checklists, dataQuality, period } = stats;
  
  // Build highlights based on available data
  const highlights: InsightV1['highlights'] = [];
  
  if (timeTracking.totalTrackedMinutes > 0) {
    highlights.push({
      title: 'Time Tracked',
      detail: `You logged ${formatMinutes(timeTracking.totalTrackedMinutes)} across ${timeTracking.sessionMetrics.totalSessions} sessions`,
      metric: formatMinutes(timeTracking.totalTrackedMinutes),
    });
    
    if (timeTracking.topCategories.length > 0) {
      const top = timeTracking.topCategories[0];
      highlights.push({
        title: 'Top Category',
        detail: `${top.category} took ${Math.round(top.ratio * 100)}% of your tracked time`,
        metric: formatMinutes(top.minutes),
      });
    }
  }
  
  const totalChecklist = checklists.dayToDay.completedCount + checklists.hitMyGoal.completedCount;
  if (totalChecklist > 0) {
    highlights.push({
      title: 'Tasks Completed',
      detail: `${totalChecklist} checklist items completed this period`,
      metric: String(totalChecklist),
    });
  }
  
  if (projectHealth.liveProjectsCount > 0) {
    highlights.push({
      title: 'Active Projects',
      detail: `${projectHealth.liveProjectsCount} time-tracked project(s) active`,
      metric: String(projectHealth.liveProjectsCount),
    });
  }
  
  // Build patterns based on rhythm signals
  const patterns: InsightV1['patterns'] = [];
  
  if (timeTracking.rhythmSignals.weekendRatio !== null) {
    const weekendPct = Math.round(timeTracking.rhythmSignals.weekendRatio * 100);
    if (weekendPct > 30) {
      patterns.push({
        title: 'Weekend Worker',
        evidence: `${weekendPct}% of time tracked on weekends`,
        suggestion: 'Consider if weekend work aligns with your goals',
      });
    } else if (weekendPct < 10 && timeTracking.totalTrackedMinutes > 60) {
      patterns.push({
        title: 'Weekday Focus',
        evidence: `Only ${weekendPct}% of time on weekends`,
        suggestion: 'Good work-life boundary—keep it up!',
      });
    }
  }
  
  if (timeTracking.rhythmSignals.nightTimeRatio !== null) {
    const nightPct = Math.round(timeTracking.rhythmSignals.nightTimeRatio * 100);
    if (nightPct > 50) {
      patterns.push({
        title: 'Night Owl',
        evidence: `${nightPct}% of sessions after 6pm`,
        suggestion: 'Late sessions can impact sleep—monitor your energy levels',
      });
    } else if (nightPct < 20 && timeTracking.totalTrackedMinutes > 60) {
      patterns.push({
        title: 'Early Bird',
        evidence: `${100 - nightPct}% of sessions during daytime`,
        suggestion: 'Daytime productivity often aligns with natural energy',
      });
    }
  }
  
  if (timeTracking.sessionMetrics.shortSessionRatio > 0.5 && timeTracking.sessionMetrics.totalSessions >= 3) {
    patterns.push({
      title: 'Short Sessions',
      evidence: `${Math.round(timeTracking.sessionMetrics.shortSessionRatio * 100)}% of sessions under 15 min`,
      suggestion: 'Consider longer focus blocks for deep work',
    });
  }
  
  // Build friction points
  const friction: InsightV1['friction'] = [];
  
  if (projectHealth.under20ProgressProjects.length > 0) {
    friction.push({
      title: 'Projects Need Attention',
      evidence: `${projectHealth.under20ProgressProjects.length} project(s) under 20% progress`,
      nudge: 'Pick one and schedule dedicated time',
      examples: projectHealth.under20ProgressProjects.map(p => p.title).slice(0, 3),
    });
  }
  
  const staleD2D = checklists.dayToDay.staleItems;
  const staleHMG = checklists.hitMyGoal.staleItems;
  const allStale = [...staleD2D, ...staleHMG].slice(0, 5);
  
  if (allStale.length > 0) {
    friction.push({
      title: 'Stale Items',
      evidence: `${allStale.length} item(s) unfinished for 14+ days`,
      nudge: 'Archive or tackle these to reduce mental load',
      examples: allStale,
    });
  }
  
  if (checklists.dayToDay.totalActiveUnfinished + checklists.hitMyGoal.totalActiveUnfinished > 20) {
    friction.push({
      title: 'Task Overload',
      evidence: `${checklists.dayToDay.totalActiveUnfinished + checklists.hitMyGoal.totalActiveUnfinished} unfinished tasks`,
      nudge: 'Consider pruning or prioritizing your lists',
    });
  }
  
  // Build encouragement
  let encouragement: InsightV1['encouragement'];
  
  if (dataQuality.confidenceHint === 'low') {
    encouragement = {
      line1: 'Not enough data yet to provide meaningful insights.',
      line2: 'Keep using the app and check back soon!',
    };
  } else if (timeTracking.totalTrackedMinutes > 300) {
    encouragement = {
      line1: `You've invested ${formatMinutes(timeTracking.totalTrackedMinutes)} into your goals this period.`,
      line2: 'Every minute tracked is a step forward. Keep building momentum!',
    };
  } else if (totalChecklist > 5) {
    encouragement = {
      line1: `${totalChecklist} tasks completed—consistent progress matters!`,
      line2: "Small wins add up. You're doing great.",
    };
  } else {
    encouragement = {
      line1: 'Progress happens one step at a time.',
      line2: 'Keep showing up, and the results will follow.',
    };
  }
  
  return {
    period: {
      label: period.label,
      start: period.startISO,
      end: period.endISO,
      timezone: period.timezone,
    },
    highlights,
    patterns,
    friction,
    encouragement,
    meta: {
      confidence: dataQuality.confidenceHint,
      notes: dataQuality.notes.length > 0 
        ? dataQuality.notes.join(' ') 
        : undefined,
    },
  };
}

// ============================================================================
// AI Insight Generator
// ============================================================================

/**
 * Check if AI is enabled.
 * Priority:
 * 1. User-configured API key in localStorage
 * 2. Environment variable NEXT_PUBLIC_AI_ENABLED
 */
export function isAIEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check user-configured settings first
  if (isUserAIEnabled()) {
    return true;
  }
  
  // Fallback to environment variable (for server-side key)
  return process.env.NEXT_PUBLIC_AI_ENABLED === 'true';
}

/**
 * Get the source of AI configuration.
 */
export function getAISource(): 'user' | 'env' | 'none' {
  if (typeof window === 'undefined') return 'none';
  
  if (isUserAIEnabled()) {
    return 'user';
  }
  
  if (process.env.NEXT_PUBLIC_AI_ENABLED === 'true') {
    return 'env';
  }
  
  return 'none';
}

/**
 * Call the API route to generate AI insight.
 */
async function fetchAIInsight(stats: InsightStats): Promise<InsightV1> {
  const settings = loadAISettings();
  
  const requestBody: { stats: InsightStats; apiKey?: string; model?: string } = {
    stats,
  };
  
  // Include user-provided API key if available
  if (settings.apiKey && settings.enabled) {
    requestBody.apiKey = settings.apiKey;
    if (settings.model) {
      requestBody.model = settings.model;
    }
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
 * - Uses mock generator if AI is disabled
 * - Calls API route if AI is enabled
 * - Caches the result
 */
export async function generateInsight(
  stats: InsightStats,
  options: GenerateInsightOptions = {}
): Promise<GenerateInsightResult> {
  const { forceRefresh = false } = options;
  
  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedInsight(stats.period);
    if (cached) {
      return { insight: cached, fromCache: true };
    }
  }
  
  let insight: InsightV1;
  
  try {
    if (isAIEnabled()) {
      // Use real AI
      insight = await fetchAIInsight(stats);
    } else {
      // Use mock generator
      insight = generateMockInsight(stats);
    }
    
    // Cache the result
    setCachedInsight(stats.period, insight);
    
    return { insight, fromCache: false };
  } catch (error) {
    // On error, try to return cached version if available
    const cached = getCachedInsight(stats.period);
    if (cached) {
      return {
        insight: cached,
        fromCache: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    
    // No cache available, generate mock as fallback
    insight = generateMockInsight(stats);
    return {
      insight,
      fromCache: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
