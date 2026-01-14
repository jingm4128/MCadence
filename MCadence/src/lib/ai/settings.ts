/**
 * AI Settings Management
 * 
 * Manages user-configurable AI settings with provider defaults and user overrides.
 * 
 * Behavior:
 * - Developer sets default provider/key via environment variables
 * - Users see the default provider on first use
 * - Users can override provider and supply their own API key
 * - User overrides persist and take precedence over env defaults
 * - Users can reset to defaults (clears overrides)
 */

import { AIProvider, PROVIDERS, getDefaultModel, validateAPIKeyForProvider } from './providers';

// ============================================================================
// Constants
// ============================================================================

const SETTINGS_KEY = 'mcadence_ai_settings_v2';

// ============================================================================
// Types
// ============================================================================

export interface UserAISettings {
  // User's provider override (null = use env default)
  provider: AIProvider | null;
  // User's API key override (empty = use env default key if available)
  apiKey: string;
  // User's model preference per provider
  models: Partial<Record<AIProvider, string>>;
  // Whether user has explicitly configured settings
  hasUserOverride: boolean;
}

export interface EffectiveAISettings {
  // The effective provider to use
  provider: AIProvider;
  // Whether using env default key (never expose actual key)
  usingDefaultKey: boolean;
  // User's API key (if provided)
  userApiKey: string;
  // The effective model to use
  model: string;
  // Source of the configuration
  source: 'user' | 'env' | 'none';
  // Whether AI is enabled (has valid key)
  enabled: boolean;
}

const DEFAULT_USER_SETTINGS: UserAISettings = {
  provider: null,
  apiKey: '',
  models: {},
  hasUserOverride: false,
};

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Get default AI provider from environment.
 */
export function getEnvDefaultProvider(): AIProvider {
  const provider = process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as AIProvider;
  if (provider && PROVIDERS[provider]) {
    return provider;
  }
  // Legacy fallback: if OPENAI_API_KEY was set, default to openai
  // Otherwise default to gemini as specified by user
  return 'gemini';
}

/**
 * Check if server has a default API key configured.
 * Note: The actual key is never exposed to the client.
 */
export function hasEnvDefaultKey(): boolean {
  // This is checked server-side via NEXT_PUBLIC flag
  return process.env.NEXT_PUBLIC_AI_ENABLED === 'true';
}

// ============================================================================
// User Settings Storage
// ============================================================================

/**
 * Load user AI settings from localStorage.
 */
export function loadUserSettings(): UserAISettings {
  if (typeof window === 'undefined') return DEFAULT_USER_SETTINGS;
  
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_USER_SETTINGS;
    
    const settings = JSON.parse(stored);
    return {
      ...DEFAULT_USER_SETTINGS,
      ...settings,
    };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

/**
 * Save user AI settings to localStorage.
 */
export function saveUserSettings(settings: Partial<UserAISettings>): UserAISettings {
  if (typeof window === 'undefined') return DEFAULT_USER_SETTINGS;
  
  try {
    const current = loadUserSettings();
    const updated: UserAISettings = {
      ...current,
      ...settings,
      hasUserOverride: true,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

/**
 * Reset user settings to defaults (clear all overrides).
 */
export function resetUserSettings(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// Effective Settings Computation
// ============================================================================

/**
 * Get the effective AI settings considering user overrides and env defaults.
 */
export function getEffectiveSettings(): EffectiveAISettings {
  const userSettings = loadUserSettings();
  const envProvider = getEnvDefaultProvider();
  const hasDefaultKey = hasEnvDefaultKey();
  
  // Determine effective provider
  const provider = userSettings.provider || envProvider;
  
  // Determine if using default key
  const hasValidUserKey = userSettings.apiKey.length > 0 && 
    validateAPIKeyForProvider(userSettings.apiKey, provider);
  const usingDefaultKey = !hasValidUserKey && hasDefaultKey;
  
  // Determine source
  let source: 'user' | 'env' | 'none' = 'none';
  if (hasValidUserKey) {
    source = 'user';
  } else if (usingDefaultKey) {
    source = 'env';
  }
  
  // Get model preference
  const model = userSettings.models[provider] || getDefaultModel(provider);
  
  // AI is enabled if we have either user key or default key
  const enabled = hasValidUserKey || usingDefaultKey;
  
  return {
    provider,
    usingDefaultKey,
    userApiKey: userSettings.apiKey,
    model,
    source,
    enabled,
  };
}

/**
 * Set user's provider preference.
 */
export function setUserProvider(provider: AIProvider | null): UserAISettings {
  return saveUserSettings({ provider });
}

/**
 * Set user's API key.
 */
export function setUserApiKey(apiKey: string): UserAISettings {
  return saveUserSettings({ apiKey });
}

/**
 * Set user's model preference for a provider.
 */
export function setUserModel(provider: AIProvider, model: string): UserAISettings {
  const current = loadUserSettings();
  return saveUserSettings({
    models: {
      ...current.models,
      [provider]: model,
    },
  });
}

// ============================================================================
// API Request Helpers
// ============================================================================

export interface AIRequestConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;  // User's API key if provided (server will use default if not)
  useDefaultKey: boolean;
}

/**
 * Get configuration for making an AI API request.
 * This is what gets sent to the server-side API routes.
 */
export function getAIRequestConfig(): AIRequestConfig {
  const effective = getEffectiveSettings();
  
  return {
    provider: effective.provider,
    model: effective.model,
    apiKey: effective.userApiKey || undefined,
    useDefaultKey: effective.usingDefaultKey,
  };
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

// Re-export types for backward compatibility
export type { AIProvider };

// Legacy AISettings interface for backward compatibility
export interface AISettings {
  apiKey: string;
  model: string;
  enabled: boolean;
  provider?: AIProvider;
}

/**
 * Load AI settings (legacy compatibility).
 */
export function loadAISettings(): AISettings {
  const effective = getEffectiveSettings();
  return {
    apiKey: effective.userApiKey,
    model: effective.model,
    enabled: effective.enabled,
    provider: effective.provider,
  };
}

/**
 * Save AI settings (legacy compatibility).
 */
export function saveAISettings(settings: Partial<AISettings>): AISettings {
  if (settings.apiKey !== undefined) {
    setUserApiKey(settings.apiKey);
  }
  if (settings.model !== undefined) {
    const effective = getEffectiveSettings();
    setUserModel(effective.provider, settings.model);
  }
  if (settings.provider !== undefined) {
    setUserProvider(settings.provider);
  }
  return loadAISettings();
}

/**
 * Clear AI settings (legacy compatibility).
 */
export function clearAISettings(): void {
  resetUserSettings();
}

/**
 * Check if user has configured their own API key (legacy compatibility).
 */
export function isUserAIEnabled(): boolean {
  const effective = getEffectiveSettings();
  return effective.source === 'user';
}

/**
 * Check if AI is enabled (either user key or default key).
 */
export function isAIEnabled(): boolean {
  return getEffectiveSettings().enabled;
}

/**
 * Get the source of AI configuration.
 */
export function getAISource(): 'user' | 'env' | 'none' {
  return getEffectiveSettings().source;
}
