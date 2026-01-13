/**
 * Quick Add Generator
 *
 * Handles generating item proposals from user text using AI.
 */

import {
  QuickAddProposal,
  QuickAddResult,
  CategoryPalette,
} from './types';
import { loadAISettings, isUserAIEnabled } from '../insight/settings';

// ============================================================================
// Check if AI is enabled
// ============================================================================

export function isQuickAddEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check user-configured settings first
  if (isUserAIEnabled()) {
    return true;
  }
  
  // Fallback to environment variable
  return process.env.NEXT_PUBLIC_AI_ENABLED === 'true';
}

// ============================================================================
// Build Category Palette
// ============================================================================

export function buildCategoryPalette(categories: {
  id: string;
  name: string;
  subcategories: { id: string; name: string; icon?: string }[]
}[]): CategoryPalette[] {
  return categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    subcategories: cat.subcategories.map(sub => ({
      id: sub.id,
      name: sub.name,
      icon: sub.icon,
    })),
  }));
}

// ============================================================================
// AI Generator
// ============================================================================

// Module-level lock for request deduplication
// Use an object to ensure reference stability
const requestLock = {
  inProgress: false,
  promise: null as Promise<QuickAddProposal[]> | null,
  key: null as string | null,
};

async function fetchAIProposals(
  text: string,
  categories: CategoryPalette[]
): Promise<QuickAddProposal[]> {
  // Generate request key
  const requestKey = `${text.substring(0, 100)}_${categories.length}`;
  
  // SYNCHRONOUS CHECK AND LOCK - must happen before any await
  if (requestLock.inProgress && requestLock.key === requestKey && requestLock.promise) {
    return requestLock.promise;
  }
  
  // Acquire lock SYNCHRONOUSLY
  requestLock.inProgress = true;
  requestLock.key = requestKey;
  
  const settings = loadAISettings();
  
  const requestBody: {
    text: string;
    categories: CategoryPalette[];
    apiKey?: string;
    model?: string;
  } = {
    text,
    categories,
  };
  
  if (settings.apiKey && settings.enabled) {
    requestBody.apiKey = settings.apiKey;
    if (settings.model) {
      requestBody.model = settings.model;
    }
  }
  
  // Create promise and store it
  requestLock.promise = (async () => {
    try {
      const response = await fetch('/api/quickadd', {
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
      
      if (!data.success || !data.proposals) {
        throw new Error('Invalid API response');
      }
      
      return data.proposals;
    } finally {
      // Release lock
      requestLock.inProgress = false;
      requestLock.promise = null;
      requestLock.key = null;
    }
  })();
  
  return requestLock.promise;
}

// ============================================================================
// Main Generate Function
// ============================================================================

export async function generateQuickAddProposals(
  text: string,
  categories: CategoryPalette[]
): Promise<QuickAddResult> {
  if (!text.trim()) {
    return { proposals: [], error: 'No text provided' };
  }
  
  // Check if AI is enabled
  if (!isQuickAddEnabled()) {
    return { proposals: [], error: 'AI is not enabled. Please configure your OpenAI API key in settings.' };
  }
  
  // Call AI API
  const proposals = await fetchAIProposals(text, categories);
  return { proposals };
}
