/**
 * Quick Add API Route
 * 
 * POST /api/quickadd
 * 
 * Takes user text and category palette, returns structured item proposals.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  QuickAddProposal,
  QuickAddAPIResponse,
  QuickAddAPIError,
  CategoryPalette,
} from '@/lib/ai/quickadd';

// ============================================================================
// Configuration
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const AI_TEMPERATURE = 0.3;
const AI_MAX_TOKENS = 2000;
const MAX_REQUEST_SIZE = 50 * 1024; // 50KB max request size
const MAX_TEXT_LENGTH = 5000; // Max characters of user text

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an AI assistant that parses unstructured text into structured productivity items.

You will receive:
1. User text (could be chat logs, bullet points, random thoughts, etc.)
2. A list of available categories with their subcategories

Your task is to extract actionable items and classify them into one of three types:
- "task": Day-to-day tasks (tab: "dayToDay") - random tasks, to-dos, quick things to do
- "goal": Goals and challenges (tab: "hitMyGoal") - longer-term objectives, challenges, things to achieve
- "time_project": Weekly time projects (tab: "spendMyTime") - recurring activities that need time allocation

Return a JSON response with this EXACT schema:
{
  "proposals": [
    {
      "id": string,           // Generate a unique ID (use format like "prop_1", "prop_2", etc.)
      "type": "task" | "goal" | "time_project",
      "tab": "dayToDay" | "hitMyGoal" | "spendMyTime",
      "title": string,        // Clear, actionable title (max 80 chars)
      "categoryId": string,   // ID from the provided categories
      "categoryName": string, // Name of the category for display
      "confidence": number,   // 0-1, how confident you are about this classification
      "reason": string,       // Brief reason for this classification
      "requiredMinutes": number  // ONLY for time_project type - weekly time in minutes
    }
  ]
}

RULES:
1. ONLY return valid JSON - no markdown, no explanation, no code blocks
2. Extract actionable items only - skip greetings, filler text, or unclear items
3. For time projects, estimate reasonable weekly time requirements:
   - Light activities: 60-120 minutes/week
   - Medium activities: 120-300 minutes/week
   - Intensive activities: 300-600 minutes/week
4. Match items to the most appropriate category from the provided list
5. If no good category match, use the first available category
6. Keep titles clear and actionable - remove unnecessary words
7. Set confidence based on how clear the intent is (0.3 = unclear, 0.7 = clear, 0.9 = very clear)
8. Maximum 20 proposals per request
9. Truncate long titles to 80 characters`;

// ============================================================================
// Request Validation
// ============================================================================

function isValidAPIKeyFormat(key: string): boolean {
  return typeof key === 'string' && key.startsWith('sk-') && key.length >= 20;
}

function validateRequest(body: unknown): { 
  valid: boolean; 
  error?: string; 
  text?: string;
  categories?: CategoryPalette[];
  apiKey?: string;
  model?: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }
  
  const b = body as Record<string, unknown>;
  
  if (typeof b.text !== 'string' || !b.text.trim()) {
    return { valid: false, error: 'Text is required' };
  }
  
  if (b.text.length > MAX_TEXT_LENGTH) {
    return { valid: false, error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` };
  }
  
  if (!Array.isArray(b.categories)) {
    return { valid: false, error: 'Categories array is required' };
  }
  
  return {
    valid: true,
    text: b.text as string,
    categories: b.categories as CategoryPalette[],
    apiKey: typeof b.apiKey === 'string' ? b.apiKey : undefined,
    model: typeof b.model === 'string' ? b.model : undefined,
  };
}

// ============================================================================
// JSON Extraction
// ============================================================================

function extractJSON(text: string): { proposals: QuickAddProposal[] } {
  // First, try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // Try to find JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No valid JSON found in response');
  }
}

function validateProposals(data: unknown): data is { proposals: QuickAddProposal[] } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.proposals);
}

// ============================================================================
// AI Call
// ============================================================================

async function callOpenAI(
  text: string,
  categories: CategoryPalette[],
  options: { apiKey?: string; model?: string } = {}
): Promise<QuickAddProposal[]> {
  const apiKey = options.apiKey || OPENAI_API_KEY;
  const model = options.model || AI_MODEL;
  
  if (!apiKey) {
    throw new Error('No API key available. Please configure your OpenAI API key in settings.');
  }
  
  if (!isValidAPIKeyFormat(apiKey)) {
    throw new Error('Invalid API key format. OpenAI keys should start with "sk-"');
  }
  
  // Build user message
  const categoryList = categories.map(cat => 
    `${cat.name} (${cat.id}): ${cat.subcategories.map(s => `${s.name} [${s.id}]`).join(', ')}`
  ).join('\n');
  
  const userMessage = `Parse the following text into structured items.

AVAILABLE CATEGORIES:
${categoryList}

USER TEXT:
${text}`;
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: AI_TEMPERATURE,
      max_tokens: AI_MAX_TOKENS,
      response_format: { type: 'json_object' },
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`;
    
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
    } else if (response.status === 429) {
      throw new Error(errorData.error?.message || 'Rate limit exceeded. Please try again later.');
    } else if (response.status === 402) {
      throw new Error('Billing issue with OpenAI account. Please check your OpenAI billing.');
    }
    
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Empty response from AI');
  }
  
  // Extract and validate JSON
  const result = extractJSON(content);
  
  if (!validateProposals(result)) {
    throw new Error('AI response does not match expected schema');
  }
  
  // Post-process proposals to ensure they have valid structure
  return result.proposals.map((p, index) => ({
    ...p,
    id: p.id || `prop_${index + 1}`,
    confidence: typeof p.confidence === 'number' ? Math.min(1, Math.max(0, p.confidence)) : 0.5,
  }));
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<QuickAddAPIResponse | QuickAddAPIError>> {
  try {
    // Check request size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Request too large', code: 'REQUEST_TOO_LARGE' },
        { status: 413 }
      );
    }
    
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }
    
    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error!, code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }
    
    // Check if any API key is available
    const hasUserKey = validation.apiKey && isValidAPIKeyFormat(validation.apiKey);
    const hasServerKey = !!OPENAI_API_KEY;
    
    if (!hasUserKey && !hasServerKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No API key configured. Please add your OpenAI API key in AI Settings.',
          code: 'API_KEY_REQUIRED'
        },
        { status: 400 }
      );
    }
    
    // Call AI
    const proposals = await callOpenAI(
      validation.text!,
      validation.categories!,
      {
        apiKey: validation.apiKey,
        model: validation.model,
      }
    );
    
    return NextResponse.json({
      success: true,
      proposals,
    });
    
  } catch (error) {
    console.error('Quick Add API error:', error);
    
    let statusCode = 500;
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    if (errorMessage.includes('Invalid API key') || errorMessage.includes('API key')) {
      statusCode = 401;
    } else if (errorMessage.includes('Rate limit')) {
      statusCode = 429;
    } else if (errorMessage.includes('Billing')) {
      statusCode = 402;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: 'INTERNAL_ERROR',
      },
      { status: statusCode }
    );
  }
}
