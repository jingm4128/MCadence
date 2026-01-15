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

// Settings
export {
  getEffectiveSettings,
  getAIRequestConfig,
  type EffectiveAISettings,
  type UserAISettings,
  type AIRequestConfig,
} from '../settings';

// Provider utilities
export {
  maskAPIKey,
  validateAPIKeyForProvider,
  PROVIDERS,
  PROVIDER_LIST,
  getProviderConfig,
  getDefaultModel,
  type AIProvider,
  type ProviderConfig,
  type ProviderModel,
} from '../providers';
