/**
 * AI Provider Configuration
 * 
 * Defines supported AI providers and their configurations.
 * Handles provider-specific API calls and model mappings.
 */

// ============================================================================
// Types
// ============================================================================

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  defaultModel: string;
  models: ProviderModel[];
  apiKeyPrefix?: string;
  apiKeyPlaceholder: string;
  apiKeyHelpUrl: string;
  validateKeyFormat: (key: string) => boolean;
}

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
}

// ============================================================================
// Provider Configurations
// ============================================================================

export const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Powerful with vision' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fastest' },
    ],
    apiKeyPrefix: 'sk-',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHelpUrl: 'https://platform.openai.com/api-keys',
    validateKeyFormat: (key: string) => key.startsWith('sk-') && key.length >= 20,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and free tier' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Stable' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable' },
    ],
    apiKeyPrefix: 'AIza',
    apiKeyPlaceholder: 'AIza...',
    apiKeyHelpUrl: 'https://aistudio.google.com/apikey',
    validateKeyFormat: (key: string) => key.startsWith('AIza') && key.length >= 30,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and affordable' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable' },
    ],
    apiKeyPrefix: 'sk-ant-',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyHelpUrl: 'https://console.anthropic.com/settings/keys',
    validateKeyFormat: (key: string) => key.startsWith('sk-ant-') && key.length >= 40,
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get provider configuration by ID.
 */
export function getProviderConfig(providerId: AIProvider): ProviderConfig {
  return PROVIDERS[providerId];
}

/**
 * Validate API key format for a specific provider.
 */
export function validateAPIKeyForProvider(key: string, providerId: AIProvider): boolean {
  const provider = PROVIDERS[providerId];
  if (!provider) return false;
  return provider.validateKeyFormat(key);
}

/**
 * Get default model for a provider.
 */
export function getDefaultModel(providerId: AIProvider): string {
  return PROVIDERS[providerId]?.defaultModel || 'gpt-4o-mini';
}

/**
 * Detect provider from API key format.
 */
export function detectProviderFromKey(key: string): AIProvider | null {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  if (key.startsWith('AIza')) return 'gemini';
  return null;
}

/**
 * Mask API key for display.
 */
export function maskAPIKey(key: string): string {
  if (key.length < 15) return '****';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

// ============================================================================
// API Endpoints
// ============================================================================

interface APIEndpointConfig {
  url: string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (messages: ChatMessage[], model: string, options?: APICallOptions) => unknown;
  extractContent: (response: unknown) => string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface APICallOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

const API_ENDPOINTS: Record<AIProvider, APIEndpointConfig> = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    buildBody: (messages, model, options = {}) => ({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
    extractContent: (response: unknown) => {
      const r = response as { choices?: { message?: { content?: string } }[] };
      return r.choices?.[0]?.message?.content || '';
    },
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    buildHeaders: () => ({
      'Content-Type': 'application/json',
    }),
    buildBody: (messages, _model, options = {}) => {
      // Convert chat messages to Gemini format
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      
      return {
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxTokens ?? 2000,
          ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      };
    },
    extractContent: (response: unknown) => {
      const r = response as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return r.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
    buildBody: (messages, model, options = {}) => {
      const systemMessage = messages.find(m => m.role === 'system')?.content;
      const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));
      
      return {
        model,
        max_tokens: options.maxTokens ?? 2000,
        ...(systemMessage ? { system: systemMessage } : {}),
        messages: chatMessages,
      };
    },
    extractContent: (response: unknown) => {
      const r = response as { content?: { text?: string }[] };
      return r.content?.[0]?.text || '';
    },
  },
};

// ============================================================================
// AI API Call
// ============================================================================

export interface AICallParams {
  provider: AIProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AICallResult {
  content: string;
  provider: AIProvider;
  model: string;
}

/**
 * Make an AI API call to the specified provider.
 */
export async function callAIProvider(params: AICallParams): Promise<AICallResult> {
  const { provider, apiKey, model, systemPrompt, userMessage, temperature, maxTokens, jsonMode } = params;
  
  const endpoint = API_ENDPOINTS[provider];
  if (!endpoint) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  // Build URL (Gemini uses model in URL)
  let url = endpoint.url;
  if (provider === 'gemini') {
    url = url.replace('{model}', model) + `?key=${apiKey}`;
  }
  
  // Build request
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
  
  const headers = endpoint.buildHeaders(apiKey);
  const body = endpoint.buildBody(messages, model, { temperature, maxTokens, jsonMode });
  
  // Make request
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = getErrorMessage(provider, response.status, errorData);
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  const content = endpoint.extractContent(data);
  
  if (!content) {
    throw new Error('Empty response from AI');
  }
  
  return { content, provider, model };
}

/**
 * Get user-friendly error message for API errors.
 */
function getErrorMessage(provider: AIProvider, status: number, errorData: unknown): string {
  const data = errorData as { error?: { message?: string } };
  const defaultMessage = data?.error?.message || `API error: ${status}`;
  
  if (status === 401) {
    return `Invalid API key. Please check your ${PROVIDERS[provider].name} API key.`;
  } else if (status === 429) {
    return 'Rate limit exceeded. Please try again later.';
  } else if (status === 402 || status === 403) {
    return `Billing or permission issue with ${PROVIDERS[provider].name}. Please check your account.`;
  }
  
  return defaultMessage;
}
