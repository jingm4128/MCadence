/**
 * AI Settings Management
 *
 * Manages user-configurable AI settings.
 * Users must provide their own API key - no default keys are included.
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
// Configuration
// ============================================================================

/**
 * Get default AI provider (always OpenAI).
 */
export function getEnvDefaultProvider(): AIProvider {
  return 'openai';
}

/**
 * Check if default API key is available.
 * Returns false - users must provide their own keys.
 */
export function hasEnvDefaultKey(): boolean {
  return false;
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
 * Check if the current settings can use the default API key.
 * Default key only works with the default provider AND default model.
 */
export function canUseDefaultKey(provider: AIProvider, model: string): boolean {
  const envProvider = getEnvDefaultProvider();
  const defaultModel = getDefaultModel(envProvider);
  const hasDefaultKey = hasEnvDefaultKey();
  
  // Default key only works with default provider + default model
  return hasDefaultKey && provider === envProvider && model === defaultModel;
}

/**
 * Get the effective AI settings considering user overrides and env defaults.
 */
export function getEffectiveSettings(): EffectiveAISettings {
  const userSettings = loadUserSettings();
  const envProvider = getEnvDefaultProvider();
  const hasDefaultKey = hasEnvDefaultKey();
  
  // Determine effective provider
  const provider = userSettings.provider || envProvider;
  
  // Get model preference
  const model = userSettings.models[provider] || getDefaultModel(provider);
  
  // Determine if using default key
  // Default key only works with default provider + default model
  const hasValidUserKey = userSettings.apiKey.length > 0 &&
    validateAPIKeyForProvider(userSettings.apiKey, provider);
  
  // Check if user can use the default key
  const canUseDefault = canUseDefaultKey(provider, model);
  const usingDefaultKey = !hasValidUserKey && canUseDefault;
  
  // Determine source
  let source: 'user' | 'env' | 'none' = 'none';
  if (hasValidUserKey) {
    source = 'user';
  } else if (usingDefaultKey) {
    source = 'env';
  }
  
  // AI is enabled if we have either user key or can use default key
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

// Re-export types
export type { AIProvider };

/**
 * Check if AI is enabled.
 */
export function isAIEnabled(): boolean {
  return getEffectiveSettings().enabled;
}
