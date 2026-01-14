/**
 * Server-Side AI Configuration
 * 
 * This file contains server-side only configuration for AI providers.
 * Default API keys are managed here and never exposed to clients.
 * 
 * Environment Variables:
 * - DEFAULT_AI_PROVIDER: Default provider (openai, gemini, anthropic)
 * - DEFAULT_OPENAI_API_KEY: Default OpenAI API key
 * - DEFAULT_GEMINI_API_KEY: Default Gemini API key
 * - DEFAULT_ANTHROPIC_API_KEY: Default Anthropic API key
 * 
 * Legacy Support:
 * - OPENAI_API_KEY: Falls back to this if DEFAULT_OPENAI_API_KEY not set
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

/**
 * Get the default AI provider from environment.
 */
export function getServerDefaultProvider(): AIProvider {
  const provider = process.env.DEFAULT_AI_PROVIDER as AIProvider;
  if (provider && PROVIDERS[provider]) {
    return provider;
  }
  // Default to openai
  return 'openai';
}

/**
 * Get the default API key for a provider from environment.
 * Returns null if no default key is configured.
 */
export function getServerDefaultApiKey(provider: AIProvider): string | null {
  switch (provider) {
    case 'openai':
      return process.env.DEFAULT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || null;
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
