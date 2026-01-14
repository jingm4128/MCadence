/**
 * AI Insight Module
 *
 * Re-exports all insight-related types and functions.
 */

// Types
export * from './types';

// Stats builder
export { buildInsightStats } from './stats';

// Generator
export {
  getCachedInsight,
  setCachedInsight,
  clearCachedInsight,
  isAIEnabled,
  getAISource,
  generateInsight,
  type GenerateInsightOptions,
  type GenerateInsightResult,
} from './generate';

// Settings - re-export from central settings module for backward compatibility
export {
  loadAISettings,
  saveAISettings,
  clearAISettings,
  isUserAIEnabled,
  isAIEnabled as checkAIEnabled,
  getAISource as checkAISource,
  getEffectiveSettings,
  getAIRequestConfig,
  type AISettings,
  type EffectiveAISettings,
  type UserAISettings,
  type AIRequestConfig,
} from '../settings';

// Provider utilities
export {
  maskAPIKey,
  validateAPIKeyForProvider,
  validateAPIKeyForProvider as isValidAPIKeyFormat, // Legacy alias
  PROVIDERS,
  PROVIDER_LIST,
  getProviderConfig,
  getDefaultModel,
  type AIProvider,
  type ProviderConfig,
  type ProviderModel,
} from '../providers';
