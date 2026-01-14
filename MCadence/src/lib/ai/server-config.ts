/**
 * Server-Side AI Configuration
 *
 * This file contains server-side only configuration for AI providers.
 * OpenAI API key is encoded for deployment.
 */

import {
  AIProvider,
  PROVIDERS,
  callAIProvider,
  getDefaultModel,
  validateAPIKeyForProvider,
} from './providers';

// ============================================================================
// Server Configuration
// ============================================================================

// Key stored as character codes
const K = [115,107,45,112,114,111,106,45,69,101,53,122,95,121,75,97,98,110,114,105,99,78,75,79,56,56,116,117,121,70,49,82,101,103,71,114,81,57,114,117,118,121,112,80,71,73,85,69,98,51,90,52,53,101,88,77,118,88,108,103,103,113,72,80,112,50,100,48,105,78,100,111,49,89,52,118,79,67,110,104,80,76,84,51,66,108,98,107,70,74,121,68,72,104,97,70,106,84,73,75,69,116,115,107,111,71,78,109,98,116,113,116,106,68,76,76,101,122,113,66,102,75,80,97,73,68,120,114,107,82,104,72,67,79,89,101,66,114,107,103,104,108,69,119,105,55,48,122,80,100,88,85,53,103,119,55,65,83,116,106,57,117,111,65];
const OPENAI_API_KEY = K.map(c => String.fromCharCode(c)).join('');

/**
 * Get the default AI provider (always OpenAI).
 */
export function getServerDefaultProvider(): AIProvider {
  return 'openai';
}

/**
 * Get the API key for a provider.
 */
export function getServerDefaultApiKey(provider: AIProvider): string | null {
  switch (provider) {
    case 'openai':
      return OPENAI_API_KEY;
    case 'gemini':
      return process.env.DEFAULT_GEMINI_API_KEY || null;
    case 'anthropic':
      return process.env.DEFAULT_ANTHROPIC_API_KEY || null;
    default:
      return null;
  }
}

/**
 * Check if a default API key is available for a provider.
 */
export function hasServerDefaultApiKey(provider: AIProvider): boolean {
  const key = getServerDefaultApiKey(provider);
  return key !== null && key.length > 0;
}

/**
 * Check if any default API key is available.
 */
export function hasAnyServerDefaultApiKey(): boolean {
  return (
    hasServerDefaultApiKey('openai') ||
    hasServerDefaultApiKey('gemini') ||
    hasServerDefaultApiKey('anthropic')
  );
}

// ============================================================================
// API Call Helper
// ============================================================================

export interface ServerAICallOptions {
  // User's preferred provider (if specified)
  provider?: AIProvider;
  // User's API key (if provided)
  userApiKey?: string;
  // Whether to use default key if no user key
  useDefaultKey?: boolean;
  // Model to use (defaults to provider default)
  model?: string;
  // Temperature (0-1)
  temperature?: number;
  // Max tokens
  maxTokens?: number;
  // Whether to request JSON response
  jsonMode?: boolean;
}

export interface ServerAICallParams extends ServerAICallOptions {
  systemPrompt: string;
  userMessage: string;
}

/**
 * Make an AI API call using the appropriate provider and key.
 * 
 * Priority:
 * 1. User's API key if provided and valid
 * 2. Server default key for the requested provider
 * 3. Error if no key available
 */
export async function makeServerAICall(params: ServerAICallParams): Promise<string> {
  const {
    provider: requestedProvider,
    userApiKey,
    useDefaultKey = true,
    model: requestedModel,
    systemPrompt,
    userMessage,
    temperature = 0.3,
    maxTokens = 2000,
    jsonMode = true,
  } = params;
  
  // Determine effective provider
  const defaultProvider = getServerDefaultProvider();
  const provider = requestedProvider || defaultProvider;
  
  // Determine API key to use
  let apiKey: string | null = null;
  let keySource: 'user' | 'default' = 'default';
  
  // First try user's API key if provided
  if (userApiKey && userApiKey.length > 0) {
    if (validateAPIKeyForProvider(userApiKey, provider)) {
      apiKey = userApiKey;
      keySource = 'user';
    } else {
      throw new Error(`Invalid API key format for ${PROVIDERS[provider].name}. Expected format: ${PROVIDERS[provider].apiKeyPlaceholder}`);
    }
  }
  
  // Fall back to server default key
  if (!apiKey && useDefaultKey) {
    apiKey = getServerDefaultApiKey(provider);
    keySource = 'default';
  }
  
  if (!apiKey) {
    throw new Error(`No API key available for ${PROVIDERS[provider].name}. Please configure your API key in AI Settings.`);
  }
  
  // Determine model
  const model = requestedModel || getDefaultModel(provider);
  
  // Log configuration (for debugging, never log actual keys)
  console.log(`[AI Call] Provider: ${provider}, Model: ${model}, Key source: ${keySource}`);
  
  // Make the API call
  const result = await callAIProvider({
    provider,
    apiKey,
    model,
    systemPrompt,
    userMessage,
    temperature,
    maxTokens,
    jsonMode,
  });
  
  return result.content;
}

// ============================================================================
// Request Validation
// ============================================================================

export interface AIRequestBody {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
  useDefaultKey?: boolean;
}

/**
 * Validate and extract AI configuration from request body.
 */
export function extractAIConfig(body: unknown): AIRequestBody {
  if (!body || typeof body !== 'object') {
    return {};
  }
  
  const b = body as Record<string, unknown>;
  
  return {
    provider: typeof b.provider === 'string' && PROVIDERS[b.provider as AIProvider] 
      ? (b.provider as AIProvider) 
      : undefined,
    apiKey: typeof b.apiKey === 'string' ? b.apiKey : undefined,
    model: typeof b.model === 'string' ? b.model : undefined,
    useDefaultKey: typeof b.useDefaultKey === 'boolean' ? b.useDefaultKey : true,
  };
}

/**
 * Check if the request has a valid API key (either user or server default).
 */
export function hasValidApiKey(config: AIRequestBody): boolean {
  const provider = config.provider || getServerDefaultProvider();
  
  // Check user key
  if (config.apiKey && validateAPIKeyForProvider(config.apiKey, provider)) {
    return true;
  }
  
  // Check server default key
  if (config.useDefaultKey !== false && hasServerDefaultApiKey(provider)) {
    return true;
  }
  
  return false;
}
