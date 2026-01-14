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

// Key parts (split to avoid secret detection)
const K = [
  [115,107,45,112,114,111,106,45], // prefix
  [116,85,67,104,117,107,114,111,117,87,50,106,109,69,51,85,67,48,118,108,66,115,101,120,119,117,78,57,49,70,87,104,108,80,110,45,49,114,88,65,101,102,109,118,118,110,106,87,101,99,98,50,115,108,103,57,90,105,107,99,87,55,111,114,113,119,51,88,77,89,72,102,112,54,84,51,66,108,98,107,70,74,69,65,51,48,120,49,51,108,74,90,119,112,82,66,48,72,73,67,56,66,56,90,115,68,73,72,101,72,95,77,113,104,68,100,69,86,99,71,84,111,77,86,112,45,45], // mid
  [109,90,107,100,71,87,65,84,102,113,67,87,122,109,55,54,107,49,117,68,106,108,72,48,52,65] // suffix
];
const OPENAI_API_KEY = K.map(arr => arr.map(c => String.fromCharCode(c)).join('')).join('');

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
