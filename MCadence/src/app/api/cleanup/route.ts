/**
 * Cleanup API Route
 * 
 * POST /api/cleanup
 * 
 * Takes cleanup stats and returns AI-generated cleanup suggestions.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CleanupStats,
  CleanupSuggestion,
  CleanupAPIResponse,
  CleanupAPIError,
} from '@/lib/ai/cleanup';

// ============================================================================
// Configuration
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const AI_TEMPERATURE = 0.3;
const AI_MAX_TOKENS = 2000;
const MAX_REQUEST_SIZE = 50 * 1024; // 50KB max request size

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an AI assistant that helps users clean up their productivity system by suggesting items to archive or delete.

You will receive statistics about items that might need cleanup:
- staleChecklistItems: Unfinished checklist items that are old
- lowProgressProjects: Time projects with very low progress
- longDoneItems: Completed items that have been done for a while
- inactiveItems: Items with no recent activity

Your task is to generate cleanup suggestions. Each suggestion should recommend either:
- "archive": Keep the item but move it to archived status (reversible)
- "delete": Permanently remove the item (irreversible, use sparingly)

Return a JSON response with this EXACT schema:
{
  "suggestions": [
    {
      "id": string,           // Unique suggestion ID (format: "sug_1", "sug_2", etc.)
      "itemId": string,       // The item's actual ID from the stats
      "itemTitle": string,    // Item title for display
      "itemTab": string,      // "dayToDay" | "hitMyGoal" | "spendMyTime"
      "action": "archive" | "delete",
      "reason": string,       // Brief, evidence-based reason (max 100 chars)
      "confidence": number    // 0-1, how confident you are
    }
  ]
}

RULES:
1. ONLY return valid JSON - no markdown, no explanation, no code blocks
2. Use ONLY data provided in the stats - never invent numbers
3. Prefer "archive" over "delete" - delete should only be suggested for items that:
   - Have been inactive for a very long time (60+ days)
   - Have zero progress and are clearly abandoned
   - Are duplicates or obviously irrelevant
4. Write clear, helpful reasons that explain why this action is suggested
5. Set confidence based on how clear the evidence is:
   - 0.3-0.5: Some indicators but not definitive
   - 0.6-0.7: Clear indicators
   - 0.8-0.9: Very strong evidence
6. Maximum 15 suggestions total
7. Group similar items if possible (e.g., multiple stale items from same category)
8. Don't suggest cleanup for items that might just need a little push`;

// ============================================================================
// Request Validation
// ============================================================================

function isValidAPIKeyFormat(key: string): boolean {
  return typeof key === 'string' && key.startsWith('sk-') && key.length >= 20;
}

function validateStats(stats: unknown): stats is CleanupStats {
  if (!stats || typeof stats !== 'object') return false;
  
  const s = stats as Record<string, unknown>;
  
  return (
    s.statsVersion === 'v1' &&
    typeof s.generatedAt === 'string' &&
    typeof s.period === 'object' &&
    Array.isArray(s.staleChecklistItems) &&
    Array.isArray(s.lowProgressProjects) &&
    Array.isArray(s.longDoneItems) &&
    Array.isArray(s.inactiveItems)
  );
}

// ============================================================================
// JSON Extraction
// ============================================================================

function extractJSON(text: string): { suggestions: CleanupSuggestion[] } {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No valid JSON found in response');
  }
}

function validateSuggestions(data: unknown): data is { suggestions: CleanupSuggestion[] } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.suggestions);
}

// ============================================================================
// AI Call
// ============================================================================

async function callOpenAI(
  stats: CleanupStats,
  options: { apiKey?: string; model?: string } = {}
): Promise<CleanupSuggestion[]> {
  const apiKey = options.apiKey || OPENAI_API_KEY;
  const model = options.model || AI_MODEL;
  
  // Debug logging
  console.log('[Cleanup API] Configuration:', {
    hasUserKey: !!options.apiKey,
    hasServerKey: !!OPENAI_API_KEY,
    usingKey: options.apiKey ? 'user' : 'server',
    keyPrefix: apiKey ? apiKey.slice(0, 10) + '...' : 'none',
    model,
    staleItems: stats.staleChecklistItems.length,
    lowProgressProjects: stats.lowProgressProjects.length,
  });
  
  if (!apiKey) {
    throw new Error('No API key available. Please configure your OpenAI API key in settings.');
  }
  
  if (!isValidAPIKeyFormat(apiKey)) {
    throw new Error('Invalid API key format. OpenAI keys should start with "sk-"');
  }
  
  const userMessage = `Analyze the following cleanup statistics and suggest items to archive or delete:

${JSON.stringify(stats, null, 2)}`;
  
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
      throw new Error('Rate limit exceeded. Please try again later or check your OpenAI plan.');
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
  
  const result = extractJSON(content);
  
  if (!validateSuggestions(result)) {
    throw new Error('AI response does not match expected schema');
  }
  
  // Post-process suggestions
  return result.suggestions.map((s, index) => ({
    ...s,
    id: s.id || `sug_${index + 1}`,
    confidence: typeof s.confidence === 'number' ? Math.min(1, Math.max(0, s.confidence)) : 0.5,
  }));
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<CleanupAPIResponse | CleanupAPIError>> {
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
    let body: { stats?: CleanupStats; apiKey?: string; model?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }
    
    // Validate stats
    if (!validateStats(body.stats)) {
      return NextResponse.json(
        { success: false, error: 'Invalid stats format', code: 'INVALID_STATS' },
        { status: 400 }
      );
    }
    
    // Check if any API key is available
    const hasUserKey = body.apiKey && isValidAPIKeyFormat(body.apiKey);
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
    const suggestions = await callOpenAI(body.stats, {
      apiKey: body.apiKey,
      model: body.model,
    });
    
    return NextResponse.json({
      success: true,
      suggestions,
    });
    
  } catch (error) {
    console.error('Cleanup API error:', error);
    
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
