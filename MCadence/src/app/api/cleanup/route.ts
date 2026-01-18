/**
 * Cleanup API Route
 * 
 * POST /api/cleanup
 * 
 * Takes cleanup stats and returns AI-generated cleanup suggestions.
 * Supports multiple providers: OpenAI, Gemini, Anthropic.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CleanupStats,
  CleanupSuggestion,
  CleanupAPIResponse,
  CleanupAPIError,
} from '@/lib/ai/cleanup';
import { makeServerAICall, extractAIConfig, hasValidApiKey } from '@/lib/ai/server-config';
import { MAX_REQUEST_SIZE, extractJSONFromText, getErrorStatusCode } from '@/lib/ai/utils';

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

function validateSuggestions(data: unknown): data is { suggestions: CleanupSuggestion[] } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.suggestions);
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
    let body: { stats?: CleanupStats; provider?: string; apiKey?: string; model?: string; useDefaultKey?: boolean };
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
    
    // Extract AI configuration
    const aiConfig = extractAIConfig(body);
    
    // Check if any API key is available
    if (!hasValidApiKey(aiConfig)) {
      return NextResponse.json(
        {
          success: false,
          error: 'No API key configured. Please add your API key in AI Settings.',
          code: 'API_KEY_REQUIRED'
        },
        { status: 400 }
      );
    }
    
    // Build user message
    const userMessage = `Analyze the following cleanup statistics and suggest items to archive or delete:

${JSON.stringify(body.stats, null, 2)}`;
    
    // Call AI
    const content = await makeServerAICall({
      ...aiConfig,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      temperature: 0.3,
      maxTokens: 2000,
      jsonMode: true,
    });
    
    // Extract and validate JSON
    const result = extractJSONFromText<{ suggestions: CleanupSuggestion[] }>(content);
    
    if (!validateSuggestions(result)) {
      throw new Error('AI response does not match expected schema');
    }
    
    // Post-process suggestions
    const suggestions = result.suggestions.map((s, index) => ({
      ...s,
      id: s.id || `sug_${index + 1}`,
      confidence: typeof s.confidence === 'number' ? Math.min(1, Math.max(0, s.confidence)) : 0.5,
    }));
    
    return NextResponse.json({
      success: true,
      suggestions,
    });
    
  } catch (error) {
    console.error('Cleanup API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = getErrorStatusCode(errorMessage);
    
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
