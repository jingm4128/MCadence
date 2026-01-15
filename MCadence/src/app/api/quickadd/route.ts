/**
 * Quick Add API Route
 * 
 * POST /api/quickadd
 * 
 * Takes user text and category palette, returns structured item proposals.
 * Supports multiple providers: OpenAI, Gemini, Anthropic.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  QuickAddProposal,
  QuickAddAPIResponse,
  QuickAddAPIError,
  CategoryPalette,
  RecurrenceType,
  QuickAddTab,
} from '@/lib/ai/quickadd';
import { makeServerAICall, extractAIConfig, hasValidApiKey } from '@/lib/ai/server-config';

// ============================================================================
// Configuration
// ============================================================================

const MAX_REQUEST_SIZE = 50 * 1024; // 50KB max request size
const MAX_TEXT_LENGTH = 5000; // Max characters of user text

// ============================================================================
// System Prompt - Improved for multilingual and semantic understanding
// ============================================================================

const SYSTEM_PROMPT = `You are an expert productivity assistant that parses natural language into structured productivity items.
You support MULTILINGUAL input (English, Chinese, Japanese, Spanish, etc.).

Your task: Extract actionable items from user text and classify them appropriately.

## OUTPUT SCHEMA (strict JSON)

{
  "proposals": [
    {
      "id": "prop_1",
      "type": "task" | "goal" | "time_project",
      "tab": "dayToDay" | "hitMyGoal" | "spendMyTime",
      "title": "Clear, actionable title (max 80 chars)",
      "categoryId": "ID from categories list",
      "categoryName": "Category name for display",
      "confidence": 0.0-1.0,
      "reason": "Brief explanation",
      "recurrence": "one_off" | "daily" | "weekly" | "monthly",
      "durationMinutes": number | null,
      "frequencyPerWeek": number | null,
      "requiredMinutes": number | null
    }
  ]
}

## TAB CLASSIFICATION RULES

1. **dayToDay** (Day-to-Day Tasks):
   - One-time tasks, errands, to-dos
   - Things to complete once
   - Example: "buy groceries", "call mom", "fix the bug"

2. **hitMyGoal** (Goals):
   - Longer-term objectives, challenges, milestones
   - Achievement-oriented items
   - Example: "learn TypeScript", "lose 5kg", "read 10 books"

3. **spendMyTime** (Time Projects):
   - Recurring activities with time allocation
   - Activities you want to track time spent on
   - IMPORTANT: Any activity with recurrence (daily/weekly) AND duration should be a time project
   - Example: "exercise 30 min daily", "study 2 hours weekly", "每天跑步10分钟"

## RECURRENCE DETECTION

Detect temporal patterns carefully:

| Pattern (EN) | Pattern (ZH) | Pattern (Other) | Result |
|--------------|--------------|-----------------|--------|
| daily, every day, each day | 每天, 每日, 天天 | diario, täglich | "daily" |
| weekly, every week, once a week | 每周, 每週, 每个星期 | semanal | "weekly" |
| monthly, every month | 每月, 每个月 | mensual | "monthly" |
| No temporal pattern | 无时间词 | — | "one_off" |

## DURATION PARSING

Parse duration expressions precisely:

| Expression | Minutes |
|------------|---------|
| 10 minutes, 10 min, 10分钟 | 10 |
| 30 minutes, half hour, 半小时 | 30 |
| 1 hour, 一小时, 1小時 | 60 |
| 1.5 hours, 1h30m, 一个半小时 | 90 |
| 2 hours, 两小时, 兩小時 | 120 |

## CRITICAL RULES

1. **NEVER multiply duration by recurrence**: "每天跑步10分钟" = 10 minutes duration, NOT 70 minutes
   - durationMinutes = per-session duration (10)
   - frequencyPerWeek = sessions per week (7 for daily)
   - requiredMinutes = total weekly time (70)

2. **Prefer existing categories**: Always try to match user's existing categories first.
   Use exact categoryId from the provided list when possible.

3. **Time projects need duration**: If an item has recurrence AND duration, classify as time_project (spendMyTime tab).

4. **Conservative classification**: If unsure, choose lower confidence and simpler type (task over goal).

5. **Keep original intent**: Preserve the user's intended meaning in the title.

6. **Return ONLY valid JSON**: No markdown, no explanation, no code blocks.

## EXAMPLES

Input: "每天跑步10分钟"
Output:
{
  "proposals": [{
    "id": "prop_1",
    "type": "time_project",
    "tab": "spendMyTime",
    "title": "跑步",
    "categoryId": "[match to Health/Exercise category]",
    "categoryName": "Exercise",
    "confidence": 0.9,
    "reason": "Daily recurring activity with specific duration",
    "recurrence": "daily",
    "durationMinutes": 10,
    "frequencyPerWeek": 7,
    "requiredMinutes": 70
  }]
}

Input: "Learn TypeScript this month"
Output:
{
  "proposals": [{
    "id": "prop_1",
    "type": "goal",
    "tab": "hitMyGoal",
    "title": "Learn TypeScript",
    "categoryId": "[match to Learning/Programming category]",
    "categoryName": "Learning",
    "confidence": 0.85,
    "reason": "Learning objective with timeline",
    "recurrence": "one_off",
    "durationMinutes": null,
    "frequencyPerWeek": null,
    "requiredMinutes": null
  }]
}

Input: "Study math for 2 hours every week"
Output:
{
  "proposals": [{
    "id": "prop_1",
    "type": "time_project",
    "tab": "spendMyTime",
    "title": "Study Math",
    "categoryId": "[match to Learning/Study category]",
    "categoryName": "Study",
    "confidence": 0.9,
    "reason": "Weekly recurring activity with specific duration",
    "recurrence": "weekly",
    "durationMinutes": 120,
    "frequencyPerWeek": 1,
    "requiredMinutes": 120
  }]
}`;

// ============================================================================
// Request Validation
// ============================================================================

function validateRequest(body: unknown): { 
  valid: boolean; 
  error?: string; 
  text?: string;
  categories?: CategoryPalette[];
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
  };
}

// ============================================================================
// JSON Extraction
// ============================================================================

interface RawProposal {
  id?: string;
  type?: string;
  tab?: string;
  title?: string;
  categoryId?: string;
  categoryName?: string;
  confidence?: number;
  reason?: string;
  recurrence?: string;
  durationMinutes?: number | null;
  frequencyPerWeek?: number | null;
  requiredMinutes?: number | null;
}

function extractJSON(text: string): { proposals: RawProposal[] } {
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

function validateProposals(data: unknown): data is { proposals: RawProposal[] } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.proposals);
}

// ============================================================================
// Post-processing
// ============================================================================

function normalizeTab(tab: string | undefined): QuickAddTab {
  if (tab === 'dayToDay' || tab === 'hitMyGoal' || tab === 'spendMyTime') {
    return tab;
  }
  return 'dayToDay'; // default
}

function normalizeRecurrence(recurrence: string | undefined): RecurrenceType {
  if (recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly' || recurrence === 'one_off') {
    return recurrence;
  }
  return 'one_off'; // default
}

function postProcessProposals(
  rawProposals: RawProposal[],
  categories: CategoryPalette[]
): QuickAddProposal[] {
  // Build a flat list of all valid category IDs for validation
  const validCategoryIds = new Set<string>();
  let defaultCategoryId = '';
  let defaultCategoryName = 'General';
  
  categories.forEach(cat => {
    cat.subcategories.forEach(sub => {
      validCategoryIds.add(sub.id);
      if (!defaultCategoryId) {
        defaultCategoryId = sub.id;
        defaultCategoryName = sub.name;
      }
    });
  });
  
  return rawProposals
    .filter(p => p.title && p.title.trim())
    .map((p, index) => {
      const tab = normalizeTab(p.tab);
      const recurrence = normalizeRecurrence(p.recurrence);
      
      // Validate categoryId - ALWAYS use existing categories only
      let categoryId = p.categoryId || '';
      let categoryName = p.categoryName || '';
      
      if (!validCategoryIds.has(categoryId)) {
        // Try to find a matching category by name
        let found = false;
        for (const cat of categories) {
          for (const sub of cat.subcategories) {
            if (sub.name.toLowerCase().includes((categoryName || '').toLowerCase()) ||
                (categoryName || '').toLowerCase().includes(sub.name.toLowerCase())) {
              categoryId = sub.id;
              categoryName = sub.name;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        
        if (!found) {
          // Use default category - never create new categories
          categoryId = defaultCategoryId;
          categoryName = defaultCategoryName;
        }
      }
      
      // Compute requiredMinutes if not provided
      let requiredMinutes = p.requiredMinutes ?? null;
      const durationMinutes = p.durationMinutes ?? null;
      const frequencyPerWeek = p.frequencyPerWeek ?? null;
      
      if (requiredMinutes === null && durationMinutes !== null) {
        if (recurrence === 'daily') {
          requiredMinutes = durationMinutes * 7;
        } else if (recurrence === 'weekly') {
          requiredMinutes = durationMinutes * (frequencyPerWeek || 1);
        } else if (recurrence === 'monthly') {
          requiredMinutes = Math.round(durationMinutes / 4.33);
        } else {
          requiredMinutes = durationMinutes;
        }
      }
      
      return {
        id: p.id || `prop_${index + 1}`,
        type: tab === 'dayToDay' ? 'task' : tab === 'hitMyGoal' ? 'goal' : 'time_project',
        tab,
        title: (p.title || '').slice(0, 80),
        categoryId,
        categoryName,
        confidence: typeof p.confidence === 'number' ? Math.min(1, Math.max(0, p.confidence)) : 0.5,
        reason: p.reason,
        recurrence,
        durationMinutes: durationMinutes ?? undefined,
        frequencyPerWeek: frequencyPerWeek ?? undefined,
        requiredMinutes: requiredMinutes ?? undefined,
      };
    });
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
    
    // Build detailed category list with examples
    const categoryList = validation.categories!.map(cat => {
      const subcats = cat.subcategories.map(s => 
        `  - ${s.name} (id: "${s.id}"${s.icon ? `, icon: ${s.icon}` : ''})`
      ).join('\n');
      return `${cat.icon || '📁'} ${cat.name}:\n${subcats}`;
    }).join('\n\n');
    
    const userMessage = `Parse the following text into structured productivity items.
Use the provided categories for classification - prefer existing categories when possible.

## AVAILABLE CATEGORIES

${categoryList}

## USER TEXT

${validation.text}

## INSTRUCTIONS

1. Extract all actionable items from the text
2. For each item, determine the best tab (dayToDay, hitMyGoal, or spendMyTime)
3. Detect recurrence patterns (daily, weekly, monthly, or one_off)
4. Parse duration if mentioned (in minutes)
5. Match to the most appropriate category from the list above
6. Return ONLY valid JSON matching the schema`;
    
    // Call AI
    const content = await makeServerAICall({
      ...aiConfig,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      temperature: 0.2,
      maxTokens: 2000,
      jsonMode: true,
    });
    
    // Extract and validate JSON
    const result = extractJSON(content);
    
    if (!validateProposals(result)) {
      throw new Error('AI response does not match expected schema');
    }
    
    // Post-process proposals to ensure they have valid structure
    const proposals = postProcessProposals(result.proposals, validation.categories!);
    
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
    } else if (errorMessage.includes('Billing') || errorMessage.includes('permission')) {
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
