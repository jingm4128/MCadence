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
  generateMockInsight,
  isAIEnabled,
  getAISource,
  generateInsight,
  type GenerateInsightOptions,
  type GenerateInsightResult,
} from './generate';

// Settings
export {
  loadAISettings,
  saveAISettings,
  clearAISettings,
  getAPIKey,
  setAPIKey,
  isUserAIEnabled,
  isValidAPIKeyFormat,
  maskAPIKey,
  type AISettings,
} from './settings';
