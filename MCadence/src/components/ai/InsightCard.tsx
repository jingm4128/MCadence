'use client';

import React, { useState } from 'react';
import { InsightV1, HighlightItem, PatternItem, FrictionItem } from '@/lib/insight/types';
import { formatDate } from '@/utils/date';

// ============================================================================
// Section Components
// ============================================================================

interface SectionHeaderProps {
  icon: string;
  title: string;
  count?: number;
}

function SectionHeader({ icon, title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {count !== undefined && count > 0 && (
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Highlight Section
// ============================================================================

interface HighlightSectionProps {
  highlights: HighlightItem[];
}

function HighlightSection({ highlights }: HighlightSectionProps) {
  if (highlights.length === 0) return null;
  
  return (
    <div className="mb-6">
      <SectionHeader icon="✨" title="Highlights" count={highlights.length} />
      <div className="space-y-3">
        {highlights.map((item, index) => (
          <div key={index} className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-blue-900">{item.title}</div>
                {item.detail && (
                  <div className="text-sm text-blue-700 mt-1">{item.detail}</div>
                )}
              </div>
              {item.metric && (
                <div className="text-lg font-bold text-blue-600 ml-4">{item.metric}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Pattern Section
// ============================================================================

interface PatternSectionProps {
  patterns: PatternItem[];
}

function PatternSection({ patterns }: PatternSectionProps) {
  if (patterns.length === 0) return null;
  
  return (
    <div className="mb-6">
      <SectionHeader icon="🔄" title="Patterns" count={patterns.length} />
      <div className="space-y-3">
        {patterns.map((item, index) => (
          <div key={index} className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <div className="font-medium text-purple-900">{item.title}</div>
            <div className="text-sm text-purple-700 mt-1">{item.evidence}</div>
            {item.suggestion && (
              <div className="text-sm text-purple-600 mt-2 italic">
                💡 {item.suggestion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Friction Section
// ============================================================================

interface FrictionSectionProps {
  friction: FrictionItem[];
}

function FrictionSection({ friction }: FrictionSectionProps) {
  if (friction.length === 0) return null;
  
  return (
    <div className="mb-6">
      <SectionHeader icon="⚠️" title="Friction" count={friction.length} />
      <div className="space-y-3">
        {friction.map((item, index) => (
          <div key={index} className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="font-medium text-amber-900">{item.title}</div>
            <div className="text-sm text-amber-700 mt-1">{item.evidence}</div>
            {item.nudge && (
              <div className="text-sm text-amber-600 mt-2">
                👉 {item.nudge}
              </div>
            )}
            {item.examples && item.examples.length > 0 && (
              <div className="mt-2 text-sm text-amber-600">
                <span className="font-medium">Examples:</span>
                <ul className="list-disc list-inside mt-1">
                  {item.examples.map((ex, i) => (
                    <li key={i} className="truncate">{ex}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Encouragement Section
// ============================================================================

interface EncouragementSectionProps {
  encouragement: InsightV1['encouragement'];
}

function EncouragementSection({ encouragement }: EncouragementSectionProps) {
  return (
    <div className="mb-4">
      <SectionHeader icon="💪" title="Keep Going!" />
      <div className="bg-green-50 rounded-lg p-4 border border-green-100">
        <div className="text-green-800">{encouragement.line1}</div>
        {encouragement.line2 && (
          <div className="text-green-700 mt-1">{encouragement.line2}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Confidence Badge
// ============================================================================

interface ConfidenceBadgeProps {
  confidence: InsightV1['meta']['confidence'];
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const colors = {
    low: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-green-100 text-green-700',
  };
  
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${colors[confidence]}`}>
      {confidence} confidence
    </span>
  );
}

// ============================================================================
// Main InsightCard Component
// ============================================================================

interface InsightCardProps {
  insight: InsightV1;
  fromCache?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export function InsightCard({ 
  insight, 
  fromCache = false, 
  onRegenerate,
  isRegenerating = false,
}: InsightCardProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const text = formatInsightAsText(insight);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-900">AI Insight</h2>
          <div className="text-sm text-gray-500 mt-0.5">
            {formatDate(insight.period.start)} – {formatDate(insight.period.end)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge confidence={insight.meta.confidence} />
          {fromCache && (
            <span className="text-xs text-gray-400">(cached)</span>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="space-y-2">
        <HighlightSection highlights={insight.highlights} />
        <PatternSection patterns={insight.patterns} />
        <FrictionSection friction={insight.friction} />
        <EncouragementSection encouragement={insight.encouragement} />
      </div>
      
      {/* Meta notes */}
      {insight.meta.notes && (
        <div className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
          ℹ️ {insight.meta.notes}
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={handleCopy}
          className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex-1 px-3 py-2 text-sm text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isRegenerating ? '⏳ Generating...' : '🔄 Regenerate'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Text Formatter for Copy
// ============================================================================

function formatInsightAsText(insight: InsightV1): string {
  const lines: string[] = [];
  
  lines.push('📊 AI INSIGHT');
  lines.push(`Period: ${insight.period.start.split('T')[0]} to ${insight.period.end.split('T')[0]}`);
  lines.push(`Confidence: ${insight.meta.confidence}`);
  lines.push('');
  
  if (insight.highlights.length > 0) {
    lines.push('✨ HIGHLIGHTS');
    for (const h of insight.highlights) {
      lines.push(`• ${h.title}${h.metric ? ` (${h.metric})` : ''}`);
      if (h.detail) lines.push(`  ${h.detail}`);
    }
    lines.push('');
  }
  
  if (insight.patterns.length > 0) {
    lines.push('🔄 PATTERNS');
    for (const p of insight.patterns) {
      lines.push(`• ${p.title}`);
      lines.push(`  Evidence: ${p.evidence}`);
      if (p.suggestion) lines.push(`  💡 ${p.suggestion}`);
    }
    lines.push('');
  }
  
  if (insight.friction.length > 0) {
    lines.push('⚠️ FRICTION');
    for (const f of insight.friction) {
      lines.push(`• ${f.title}`);
      lines.push(`  ${f.evidence}`);
      if (f.nudge) lines.push(`  👉 ${f.nudge}`);
      if (f.examples && f.examples.length > 0) {
        lines.push(`  Examples: ${f.examples.join(', ')}`);
      }
    }
    lines.push('');
  }
  
  lines.push('💪 KEEP GOING');
  lines.push(insight.encouragement.line1);
  if (insight.encouragement.line2) lines.push(insight.encouragement.line2);
  
  if (insight.meta.notes) {
    lines.push('');
    lines.push(`Note: ${insight.meta.notes}`);
  }
  
  return lines.join('\n');
}
