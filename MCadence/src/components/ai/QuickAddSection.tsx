'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useAppState } from '@/lib/state';
import {
  QuickAddProposal,
  ProposalSelection,
  QuickAddTab,
  RecurrenceType,
  generateQuickAddProposals,
  buildCategoryPalette,
  isQuickAddEnabled,
  TAB_LABELS,
  TAB_ICONS,
  RECURRENCE_LABELS,
  computeWeeklyMinutes,
  getDefaultTypeFromTab,
} from '@/lib/ai/quickadd';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

// ============================================================================
// Proposal Card Component - Full Inline Editing
// ============================================================================

interface ProposalCardProps {
  proposal: QuickAddProposal;
  selection: ProposalSelection;
  categories: typeof DEFAULT_CATEGORIES;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ProposalSelection>) => void;
}

function ProposalCard({
  proposal,
  selection,
  categories,
  onToggle,
  onUpdate,
}: ProposalCardProps) {
  // Get current values (edited or original)
  const currentTab = selection.editedTab ?? proposal.tab;
  const currentTitle = selection.editedTitle ?? proposal.title;
  const currentCategoryId = selection.editedCategoryId ?? proposal.categoryId;
  const currentRecurrence = selection.editedRecurrence ?? proposal.recurrence;
  const currentDurationMinutes = selection.editedDurationMinutes ?? proposal.durationMinutes ?? 0;
  const currentFrequencyPerWeek = selection.editedFrequencyPerWeek ?? proposal.frequencyPerWeek ?? 1;
  const currentRequiredMinutes = selection.editedRequiredMinutes ?? proposal.requiredMinutes ?? 0;
  
  // Compute weekly total for display
  const computedWeeklyMinutes = computeWeeklyMinutes(
    currentDurationMinutes,
    currentRecurrence,
    currentFrequencyPerWeek
  );
  
  // Get all subcategories flattened for the dropdown
  const allSubcategories = categories.flatMap(cat =>
    cat.subcategories.map(sub => ({
      id: sub.id,
      name: `${cat.name} > ${sub.name}`,
      icon: sub.icon,
    }))
  );
  
  // Is this a time project tab?
  const isTimeProject = currentTab === 'spendMyTime';
  
  // Handle tab change - also update type
  const handleTabChange = (newTab: QuickAddTab) => {
    onUpdate(proposal.id, { editedTab: newTab });
  };
  
  // Handle duration change and recalculate required minutes
  const handleDurationChange = (minutes: number) => {
    const newRequired = computeWeeklyMinutes(minutes, currentRecurrence, currentFrequencyPerWeek);
    onUpdate(proposal.id, { 
      editedDurationMinutes: minutes,
      editedRequiredMinutes: newRequired,
    });
  };
  
  // Handle recurrence change and recalculate required minutes
  const handleRecurrenceChange = (recurrence: RecurrenceType) => {
    const newRequired = computeWeeklyMinutes(currentDurationMinutes, recurrence, currentFrequencyPerWeek);
    onUpdate(proposal.id, { 
      editedRecurrence: recurrence,
      editedRequiredMinutes: newRequired,
    });
  };
  
  // Handle frequency change and recalculate required minutes
  const handleFrequencyChange = (freq: number) => {
    const newRequired = computeWeeklyMinutes(currentDurationMinutes, currentRecurrence, freq);
    onUpdate(proposal.id, { 
      editedFrequencyPerWeek: freq,
      editedRequiredMinutes: newRequired,
    });
  };
  
  return (
    <div className={`border rounded-lg p-3 transition-all ${
      selection.selected 
        ? 'border-primary-300 bg-primary-50 shadow-sm' 
        : 'border-gray-200 bg-white opacity-60'
    }`}>
      {/* Header Row: Checkbox + Tab Selector + Confidence */}
      <div className="flex items-center gap-3 mb-3">
        <input
          type="checkbox"
          checked={selection.selected}
          onChange={() => onToggle(proposal.id)}
          className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
        />
        
        {/* Tab Selector */}
        <div className="flex gap-1 flex-1">
          {(['dayToDay', 'hitMyGoal', 'spendMyTime'] as QuickAddTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
                currentTab === tab
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={TAB_LABELS[tab]}
            >
              <span>{TAB_ICONS[tab]}</span>
              <span className="hidden sm:inline">{TAB_LABELS[tab]}</span>
            </button>
          ))}
        </div>
        
        {/* Confidence Badge */}
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {Math.round(proposal.confidence * 100)}%
        </span>
      </div>
      
      {/* Title Input */}
      <div className="mb-3">
        <input
          type="text"
          value={currentTitle}
          onChange={(e) => onUpdate(proposal.id, { editedTitle: e.target.value })}
          placeholder="Title"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
      
      {/* Category Selector */}
      <div className="mb-3">
        <select
          value={currentCategoryId}
          onChange={(e) => onUpdate(proposal.id, { editedCategoryId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          {allSubcategories.map(sub => (
            <option key={sub.id} value={sub.id}>
              {sub.icon} {sub.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Time Project Fields */}
      {isTimeProject && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          {/* Recurrence Selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recurrence</label>
            <div className="flex gap-1 flex-wrap">
              {(['one_off', 'daily', 'weekly', 'monthly'] as RecurrenceType[]).map(rec => (
                <button
                  key={rec}
                  onClick={() => handleRecurrenceChange(rec)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    currentRecurrence === rec
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {RECURRENCE_LABELS[rec]}
                </button>
              ))}
            </div>
          </div>
          
          {/* Duration per Session */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Duration {currentRecurrence !== 'one_off' ? 'per session' : ''}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={Math.floor(currentDurationMinutes / 60)}
                onChange={(e) => {
                  const hours = Math.max(0, parseInt(e.target.value) || 0);
                  const mins = currentDurationMinutes % 60;
                  handleDurationChange(hours * 60 + mins);
                }}
                className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center"
                min={0}
              />
              <span className="text-sm text-gray-500">h</span>
              <input
                type="number"
                value={currentDurationMinutes % 60}
                onChange={(e) => {
                  const mins = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                  const hours = Math.floor(currentDurationMinutes / 60);
                  handleDurationChange(hours * 60 + mins);
                }}
                className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center"
                min={0}
                max={59}
              />
              <span className="text-sm text-gray-500">m</span>
            </div>
          </div>
          
          {/* Frequency per Week (for weekly recurrence) */}
          {currentRecurrence === 'weekly' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Times per week</label>
              <input
                type="number"
                value={currentFrequencyPerWeek}
                onChange={(e) => handleFrequencyChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center"
                min={1}
                max={7}
              />
            </div>
          )}
          
          {/* Weekly Total Display */}
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
            <span>📊</span>
            <span>
              Weekly total: <strong>{Math.floor(computedWeeklyMinutes / 60)}h {computedWeeklyMinutes % 60}m</strong>
            </span>
          </div>
        </div>
      )}
      
      {/* Reason (if provided) */}
      {proposal.reason && (
        <p className="text-xs text-gray-400 mt-2 italic border-t border-gray-100 pt-2">
          {proposal.reason}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main QuickAddSection Component
// ============================================================================

interface QuickAddSectionProps {
  aiEnabled: boolean;
}

export function QuickAddSection({ aiEnabled }: QuickAddSectionProps) {
  const { state, addChecklistItem, addTimeItem } = useAppState();
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<QuickAddProposal[]>([]);
  const [selections, setSelections] = useState<Map<string, ProposalSelection>>(new Map());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Ref to prevent double API calls (React Strict Mode / double-render)
  const isGeneratingRef = useRef(false);
  
  const categories = state.categories.length > 0 ? state.categories : DEFAULT_CATEGORIES;
  
  // Generate proposals
  const handleGenerate = useCallback(async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze');
      return;
    }
    
    // Prevent double calls
    if (isGeneratingRef.current) {
      return;
    }
    
    isGeneratingRef.current = true;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const palette = buildCategoryPalette(categories);
      const result = await generateQuickAddProposals(inputText, palette);
      
      if (result.error) {
        setError(result.error);
      }
      
      if (result.proposals.length === 0 && !result.error) {
        setError('No actionable items found in the text. Try adding more specific tasks or goals.');
      }
      
      setProposals(result.proposals);
      
      // Initialize selections (all checked by default)
      const newSelections = new Map<string, ProposalSelection>();
      result.proposals.forEach(p => {
        newSelections.set(p.id, { id: p.id, selected: true });
      });
      setSelections(newSelections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposals');
    } finally {
      setIsLoading(false);
      isGeneratingRef.current = false;
    }
  }, [inputText, categories]);
  
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
  
  // Update proposal selection fields
  const handleUpdate = useCallback((id: string, updates: Partial<ProposalSelection>) => {
    setSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, { ...current, ...updates });
      }
      return newMap;
    });
  }, []);
  
  // Approve and add items
  const handleApprove = useCallback(() => {
    const selectedProposals = proposals.filter(p => selections.get(p.id)?.selected);
    
    if (selectedProposals.length === 0) {
      setError('No items selected');
      return;
    }
    
    let addedCount = 0;
    
    for (const proposal of selectedProposals) {
      const selection = selections.get(proposal.id);
      const title = selection?.editedTitle ?? proposal.title;
      const categoryId = selection?.editedCategoryId ?? proposal.categoryId;
      const tab = selection?.editedTab ?? proposal.tab;
      
      if (tab === 'dayToDay' || tab === 'hitMyGoal') {
        // Add as checklist item
        addChecklistItem(tab, { title, categoryId });
        addedCount++;
      } else if (tab === 'spendMyTime') {
        // Add as time project
        const requiredMinutes = selection?.editedRequiredMinutes ?? proposal.requiredMinutes ?? 60;
        addTimeItem({
          title,
          categoryId,
          requiredHours: Math.floor(requiredMinutes / 60),
          requiredMinutes: requiredMinutes % 60,
        });
        addedCount++;
      }
    }
    
    setSuccessMessage(`Added ${addedCount} item${addedCount !== 1 ? 's' : ''}`);
    setProposals([]);
    setSelections(new Map());
    setInputText(''); // Clear input after successful add
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000);
  }, [proposals, selections, addChecklistItem, addTimeItem]);
  
  // Count selected
  const selectedCount = Array.from(selections.values()).filter(s => s.selected).length;
  
  const quickAddEnabled = isQuickAddEnabled();
  
  return (
    <div>
      {/* Input Area */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Paste text or describe what you want to add
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Examples:
• Buy groceries
• Learn TypeScript this month
• 每天跑步10分钟
• Study math 2 hours every week
• Call mom tomorrow"
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          disabled={isLoading}
        />
      </div>
      
      {/* Generate Button */}
      <div className="mb-4">
        <button
          onClick={handleGenerate}
          disabled={isLoading || !inputText.trim() || !quickAddEnabled}
          className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              Analyzing...
            </span>
          ) : (
            '✨ Generate Proposals'
          )}
        </button>
        
        {!quickAddEnabled && (
          <p className="text-xs text-amber-600 mt-2 text-center">
            ⚠️ AI is not enabled. Configure your API key in Settings to use Quick Add.
          </p>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={handleGenerate}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">✓ {successMessage}</p>
        </div>
      )}
      
      {/* Proposals List */}
      {proposals.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">
              Proposals ({proposals.length})
            </h3>
            <span className="text-sm text-gray-500">
              {selectedCount} selected
            </span>
          </div>
          
          <div className="space-y-3 mb-4">
            {proposals.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                selection={selections.get(proposal.id) || { id: proposal.id, selected: false }}
                categories={categories}
                onToggle={handleToggle}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
          
          {/* Approve Button */}
          <button
            onClick={handleApprove}
            disabled={selectedCount === 0}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
          >
            ✓ Approve & Add ({selectedCount} item{selectedCount !== 1 ? 's' : ''})
          </button>
        </>
      )}
      
      {/* Empty State */}
      {proposals.length === 0 && !isLoading && !error && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-500 text-sm mb-2">
            Paste some text above and click "Generate Proposals" to get started.
          </p>
          <p className="text-gray-400 text-xs">
            Supports English, Chinese, and other languages. AI will detect tasks, goals, and time projects.
          </p>
        </div>
      )}
    </div>
  );
}

export default QuickAddSection;
