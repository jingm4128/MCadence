'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useAppState } from '@/lib/state';
import {
  QuickAddProposal,
  ProposalSelection,
  isChecklistProposal,
  isTimeProjectProposal,
  generateQuickAddProposals,
  buildCategoryPalette,
  isQuickAddEnabled,
} from '@/lib/ai/quickadd';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

// ============================================================================
// Proposal Card Component
// ============================================================================

interface ProposalCardProps {
  proposal: QuickAddProposal;
  selection: ProposalSelection;
  categories: typeof DEFAULT_CATEGORIES;
  onToggle: (id: string) => void;
  onEdit: (id: string, field: string, value: string | number) => void;
}

function ProposalCard({
  proposal,
  selection,
  categories,
  onToggle,
  onEdit,
}: ProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  const typeBadge = {
    task: { label: 'Task', color: 'bg-blue-100 text-blue-700' },
    goal: { label: 'Goal', color: 'bg-purple-100 text-purple-700' },
    time_project: { label: 'Time Project', color: 'bg-green-100 text-green-700' },
  };
  
  const badge = typeBadge[proposal.type];
  
  // Get all subcategories flattened
  const allSubcategories = categories.flatMap(cat => 
    cat.subcategories.map(sub => ({
      id: sub.id,
      name: `${cat.name} > ${sub.name}`,
      icon: sub.icon,
    }))
  );
  
  const currentCategoryId = selection.editedCategoryId || proposal.categoryId;
  const currentTitle = selection.editedTitle || proposal.title;
  const currentMinutes = selection.editedRequiredMinutes ?? 
    (isTimeProjectProposal(proposal) ? proposal.requiredMinutes : 0);
  
  return (
    <div className={`border rounded-lg p-3 transition-colors ${
      selection.selected 
        ? 'border-primary-300 bg-primary-50' 
        : 'border-gray-200 bg-white opacity-60'
    }`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selection.selected}
          onChange={() => onToggle(proposal.id)}
          className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
        />
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(proposal.confidence * 100)}% confidence
            </span>
          </div>
          
          {/* Title */}
          {isEditing ? (
            <input
              type="text"
              value={currentTitle}
              onChange={(e) => onEdit(proposal.id, 'title', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <p className="font-medium text-gray-900 mb-2 truncate">{currentTitle}</p>
          )}
          
          {/* Category Selector */}
          {isEditing ? (
            <select
              value={currentCategoryId}
              onChange={(e) => onEdit(proposal.id, 'categoryId', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-primary-500"
            >
              {allSubcategories.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.icon} {sub.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500">
              {allSubcategories.find(s => s.id === currentCategoryId)?.name || 'No category'}
            </p>
          )}
          
          {/* Time Project: Required Minutes */}
          {isTimeProjectProposal(proposal) && isEditing && (
            <div className="flex items-center gap-2 mt-2">
              <label className="text-sm text-gray-600">Weekly:</label>
              <input
                type="number"
                value={Math.floor(currentMinutes / 60)}
                onChange={(e) => onEdit(
                  proposal.id, 
                  'requiredMinutes', 
                  parseInt(e.target.value) * 60 + (currentMinutes % 60)
                )}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                min={0}
              />
              <span className="text-sm text-gray-500">h</span>
              <input
                type="number"
                value={currentMinutes % 60}
                onChange={(e) => onEdit(
                  proposal.id, 
                  'requiredMinutes', 
                  Math.floor(currentMinutes / 60) * 60 + parseInt(e.target.value)
                )}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                min={0}
                max={59}
              />
              <span className="text-sm text-gray-500">m</span>
            </div>
          )}
          
          {isTimeProjectProposal(proposal) && !isEditing && (
            <p className="text-sm text-gray-500 mt-1">
              📊 {Math.floor(currentMinutes / 60)}h {currentMinutes % 60}m / week
            </p>
          )}
          
          {/* Reason */}
          {proposal.reason && (
            <p className="text-xs text-gray-400 mt-2 italic">{proposal.reason}</p>
          )}
        </div>
        
        {/* Edit Button */}
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`text-xs px-2 py-1 rounded ${
            isEditing 
              ? 'bg-primary-100 text-primary-700' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>
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
  
  // Edit proposal
  const handleEdit = useCallback((id: string, field: string, value: string | number) => {
    setSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, {
          ...current,
          [`edited${field.charAt(0).toUpperCase() + field.slice(1)}`]: value,
        });
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
      const title = selection?.editedTitle || proposal.title;
      const categoryId = selection?.editedCategoryId || proposal.categoryId;
      
      if (isChecklistProposal(proposal)) {
        addChecklistItem(proposal.tab, { title, categoryId });
        addedCount++;
      } else if (isTimeProjectProposal(proposal)) {
        const requiredMinutes = selection?.editedRequiredMinutes ?? proposal.requiredMinutes;
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
          Paste text or chat here
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your chat, notes, or thoughts here...

Examples:
- Buy groceries
- Learn TypeScript this month
- Exercise 3 hours per week
- Finish the project report"
          rows={6}
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
            'Generate Proposals'
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
                onEdit={handleEdit}
              />
            ))}
          </div>
          
          {/* Approve Button */}
          <button
            onClick={handleApprove}
            disabled={selectedCount === 0}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
          >
            Approve & Add ({selectedCount} item{selectedCount !== 1 ? 's' : ''})
          </button>
        </>
      )}
      
      {/* Empty State */}
      {proposals.length === 0 && !isLoading && !error && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-500 text-sm">
            Paste some text above and click "Generate Proposals" to get started.
          </p>
        </div>
      )}
    </div>
  );
}

export default QuickAddSection;
