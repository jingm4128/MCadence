/**
 * AI Insight Settings
 * 
 * Manages user-configurable AI settings stored in localStorage.
 * The API key is stored locally and sent to the server-side API route.
 */

// ============================================================================
// Constants
// ============================================================================

const SETTINGS_KEY = 'mcadence_ai_settings_v1';

// ============================================================================
// Types
// ============================================================================

export interface AISettings {
  apiKey: string;
  model: string;
  enabled: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  apiKey: '',
  model: 'gpt-4o-mini',
  enabled: false,
};

// ============================================================================
// Settings Management
// ============================================================================

/**
 * Load AI settings from localStorage.
 */
export function loadAISettings(): AISettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    
    const settings = JSON.parse(stored);
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save AI settings to localStorage.
 */
export function saveAISettings(settings: Partial<AISettings>): AISettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  
  try {
    const current = loadAISettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Clear AI settings from localStorage.
 */
export function clearAISettings(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Get the current API key.
 */
export function getAPIKey(): string {
  return loadAISettings().apiKey;
}

/**
 * Set the API key.
 */
export function setAPIKey(apiKey: string): void {
  saveAISettings({ apiKey, enabled: apiKey.length > 0 });
}

/**
 * Check if AI is enabled (has API key configured).
 */
export function isUserAIEnabled(): boolean {
  const settings = loadAISettings();
  return settings.enabled && settings.apiKey.length > 0;
}

/**
 * Validate API key format (basic check).
 */
export function isValidAPIKeyFormat(key: string): boolean {
  // OpenAI keys start with sk- and are at least 20 chars
  return key.startsWith('sk-') && key.length >= 20;
}

/**
 * Mask API key for display (show only first 7 and last 4 chars).
 */
export function maskAPIKey(key: string): string {
  if (key.length < 15) return '****';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}
