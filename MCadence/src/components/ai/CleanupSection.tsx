'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useAppState } from '@/lib/state';
import {
  CleanupSuggestion,
  CleanupSelection,
  buildCleanupStats,
  generateCleanupSuggestions,
  isCleanupEnabled,
} from '@/lib/ai/cleanup';
import { PeriodSpec } from '@/lib/ai/insight';
import {
  getThisWeekRangeNY,
  getLast7DaysRangeNY,
  getCustomRangeNY,
  formatDateYMD,
  getNowNY,
} from '@/utils/date';
import { Modal } from '@/components/ui/Modal';

// ============================================================================
// Period Selector Component (Reused)
// ============================================================================

type PeriodOption = 'this_week' | 'last_7_days' | 'custom';

interface PeriodSelectorProps {
  selected: PeriodOption;
  onSelect: (option: PeriodOption) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}

function PeriodSelector({
  selected,
  onSelect,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: PeriodSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Analysis Period
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => onSelect('this_week')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selected === 'this_week'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => onSelect('last_7_days')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selected === 'last_7_days'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => onSelect('custom')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selected === 'custom'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Custom
        </button>
      </div>
      
      {selected === 'custom' && (
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Start</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              max={customEnd || formatDateYMD(getNowNY())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <span className="text-gray-400 mt-5">→</span>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">End</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              min={customStart}
              max={formatDateYMD(getNowNY())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Suggestion Card Component
// ============================================================================

interface SuggestionCardProps {
  suggestion: CleanupSuggestion;
  selection: CleanupSelection;
  onToggle: (id: string) => void;
}

function SuggestionCard({ suggestion, selection, onToggle }: SuggestionCardProps) {
  const actionBadge = {
    archive: { label: 'Archive', color: 'bg-amber-100 text-amber-700', icon: '📦' },
    delete: { label: 'Delete', color: 'bg-red-100 text-red-700', icon: '🗑️' },
  };
  
  const tabLabel = {
    dayToDay: 'Day to Day',
    hitMyGoal: 'Hit My Goal',
    spendMyTime: 'Spend My Time',
  };
  
  const badge = actionBadge[suggestion.action];
  
  return (
    <div className={`border rounded-lg p-3 transition-colors ${
      selection.selected 
        ? suggestion.action === 'delete'
          ? 'border-red-300 bg-red-50'
          : 'border-amber-300 bg-amber-50'
        : 'border-gray-200 bg-white opacity-60'
    }`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selection.selected}
          onChange={() => onToggle(suggestion.id)}
          className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
        />
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
              {badge.icon} {badge.label}
            </span>
            <span className="text-xs text-gray-400">
              {tabLabel[suggestion.itemTab]}
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(suggestion.confidence * 100)}% confidence
            </span>
          </div>
          
          {/* Title */}
          <p className="font-medium text-gray-900 truncate">{suggestion.itemTitle}</p>
          
          {/* Reason */}
          <p className="text-sm text-gray-500 mt-1">{suggestion.reason}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Confirmation Modal
// ============================================================================

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleteCount: number;
  archiveCount: number;
}

function ConfirmModal({ isOpen, onClose, onConfirm, deleteCount, archiveCount }: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Changes" size="sm">
      <div className="py-4">
        {deleteCount > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">⚠️ Warning: Permanent Deletion</p>
            <p className="text-sm text-red-600 mt-1">
              {deleteCount} item{deleteCount !== 1 ? 's' : ''} will be permanently deleted along with all their action history. This cannot be undone.
            </p>
          </div>
        )}
        
        {archiveCount > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-700 font-medium">📦 Archive</p>
            <p className="text-sm text-amber-600 mt-1">
              {archiveCount} item{archiveCount !== 1 ? 's' : ''} will be archived. You can restore them later.
            </p>
          </div>
        )}
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
              deleteCount > 0 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            Confirm Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Main CleanupSection Component
// ============================================================================

interface CleanupSectionProps {
  aiEnabled: boolean;
}

export function CleanupSection({ aiEnabled }: CleanupSectionProps) {
  const { state, archiveItem, deleteItem } = useAppState();
  
  // Period selection state
  const [periodOption, setPeriodOption] = useState<PeriodOption>('last_7_days');
  const [customStart, setCustomStart] = useState(() => {
    const now = getNowNY();
    return formatDateYMD(now.subtract(30, 'day'));
  });
  const [customEnd, setCustomEnd] = useState(() => formatDateYMD(getNowNY()));
  
  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CleanupSuggestion[]>([]);
  const [selections, setSelections] = useState<Map<string, CleanupSelection>>(new Map());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Get current period spec
  const period = useMemo((): PeriodSpec => {
    let range;
    let label: string;
    
    switch (periodOption) {
      case 'this_week':
        range = getThisWeekRangeNY();
        label = 'this_week';
        break;
      case 'last_7_days':
        range = getLast7DaysRangeNY();
        label = 'last_7_days';
        break;
      case 'custom':
        range = getCustomRangeNY(customStart, customEnd);
        label = `${customStart.replace(/-/g, '')}_to_${customEnd.replace(/-/g, '')}`;
        break;
    }
    
    return {
      label: label as PeriodSpec['label'],
      startISO: range.startISO,
      endISO: range.endISO,
      timezone: 'America/New_York',
    };
  }, [periodOption, customStart, customEnd]);
  
  // Generate suggestions
  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const stats = buildCleanupStats(period, state);
      const result = await generateCleanupSuggestions(stats);
      
      if (result.error) {
        setError(result.error);
      }
      
      if (result.suggestions.length === 0 && !result.error) {
        setError('No cleanup suggestions found. Your lists look well-maintained!');
      }
      
      setSuggestions(result.suggestions);
      
      // Initialize selections (all checked by default)
      const newSelections = new Map<string, CleanupSelection>();
      result.suggestions.forEach(s => {
        newSelections.set(s.id, { id: s.id, selected: true });
      });
      setSelections(newSelections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [period, state]);
  
  // Toggle selection
  const handleToggle = useCallback((id: string) => {
    setSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, { ...current, selected: !current.selected });
      }
      return newMap;
    });
  }, []);
  
  // Count selected by action
  const selectedSuggestions = useMemo(() => {
    return suggestions.filter(s => selections.get(s.id)?.selected);
  }, [suggestions, selections]);
  
  const archiveCount = selectedSuggestions.filter(s => s.action === 'archive').length;
  const deleteCount = selectedSuggestions.filter(s => s.action === 'delete').length;
  const totalSelected = archiveCount + deleteCount;
  
  // Handle approve click
  const handleApproveClick = useCallback(() => {
    if (deleteCount > 0) {
      setShowConfirm(true);
    } else {
      handleApprove();
    }
  }, [deleteCount]);
  
  // Apply changes
  const handleApprove = useCallback(() => {
    setShowConfirm(false);
    
    let archivedCount = 0;
    let deletedCount = 0;
    
    for (const suggestion of selectedSuggestions) {
      if (suggestion.action === 'archive') {
        archiveItem(suggestion.itemId);
        archivedCount++;
      } else if (suggestion.action === 'delete') {
        deleteItem(suggestion.itemId);
        deletedCount++;
      }
    }
    
    const messages: string[] = [];
    if (archivedCount > 0) messages.push(`${archivedCount} archived`);
    if (deletedCount > 0) messages.push(`${deletedCount} deleted`);
    
    setSuccessMessage(messages.join(', '));
    setSuggestions([]);
    setSelections(new Map());
    
    setTimeout(() => setSuccessMessage(null), 3000);
  }, [selectedSuggestions, archiveItem, deleteItem]);
  
  // Group suggestions
  const archiveSuggestions = suggestions.filter(s => s.action === 'archive');
  const deleteSuggestions = suggestions.filter(s => s.action === 'delete');
  
  const cleanupEnabled = isCleanupEnabled();
  
  return (
    <div>
      {/* Period Selector */}
      <PeriodSelector
        selected={periodOption}
        onSelect={setPeriodOption}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />
      
      {/* Generate Button */}
      <div className="mb-4">
        <button
          onClick={handleGenerate}
          disabled={isLoading || !cleanupEnabled}
          className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              Analyzing...
            </span>
          ) : (
            'Generate Clean-up Suggestions'
          )}
        </button>
        
        {!cleanupEnabled && (
          <p className="text-xs text-amber-600 mt-2 text-center">
            ⚠️ AI is not enabled. Configure your API key in Settings to use Clean-up.
          </p>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
          {error.includes('No cleanup suggestions') ? null : (
            <button
              onClick={handleGenerate}
              className="mt-2 text-sm text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
      
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">✓ {successMessage}</p>
        </div>
      )}
      
      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <>
          {/* Archive Suggestions */}
          {archiveSuggestions.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <span>📦 Archive Suggestions</span>
                <span className="text-sm text-gray-500">({archiveSuggestions.length})</span>
              </h3>
              <div className="space-y-2">
                {archiveSuggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    selection={selections.get(suggestion.id) || { id: suggestion.id, selected: false }}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Delete Suggestions */}
          {deleteSuggestions.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                <span>🗑️ Delete Suggestions</span>
                <span className="text-sm text-red-500">({deleteSuggestions.length})</span>
              </h3>
              <div className="space-y-2">
                {deleteSuggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    selection={selections.get(suggestion.id) || { id: suggestion.id, selected: false }}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Approve Button */}
          <button
            onClick={handleApproveClick}
            disabled={totalSelected === 0}
            className={`w-full px-4 py-3 text-white rounded-lg transition-colors disabled:opacity-50 font-medium ${
              deleteCount > 0 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            Approve Changes ({totalSelected} item{totalSelected !== 1 ? 's' : ''})
          </button>
        </>
      )}
      
      {/* Empty State */}
      {suggestions.length === 0 && !isLoading && !error && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🧹</div>
          <p className="text-gray-500 text-sm">
            Click "Generate Clean-up Suggestions" to find items that could be archived or removed.
          </p>
        </div>
      )}
      
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleApprove}
        deleteCount={deleteCount}
        archiveCount={archiveCount}
      />
    </div>
  );
}

export default CleanupSection;
