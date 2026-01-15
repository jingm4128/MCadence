'use client';

import { useState, lazy, Suspense, useCallback, useEffect } from 'react';
import { TabId, Category } from '@/lib/types';
import { useAppState } from '@/lib/state';
import { Layout } from '@/components/layout/Layout';
import { DayToDayTab } from '@/components/tabs/DayToDayTab';
import { HitMyGoalTab } from '@/components/tabs/HitMyGoalTab';
import { SpendMyTimeTab } from '@/components/tabs/SpendMyTimeTab';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ImportExportModal } from '@/components/ui/ImportExportModal';
import { CategoryEditorModal } from '@/components/ui/CategoryEditorModal';
import { exportState, clearState, saveStateImmediate, saveCategories } from '@/lib/storage';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { useHistoryGuard, useModalHistory, ModalId } from '@/hooks/useHistoryGuard';

// Lazy load AiPanel to keep main app fast
const AiPanel = lazy(() => import('@/components/ai/AiPanel'));

// Storage key for active tab
const ACTIVE_TAB_KEY = 'mcadence_active_tab';

/**
 * Load saved active tab from localStorage
 */
function loadActiveTab(): TabId {
  if (typeof window === 'undefined') return 'dayToDay';
  
  const saved = localStorage.getItem(ACTIVE_TAB_KEY);
  if (saved === 'dayToDay' || saved === 'hitMyGoal' || saved === 'spendMyTime') {
    return saved;
  }
  return 'dayToDay';
}

/**
 * Save active tab to localStorage
 */
function saveActiveTab(tab: TabId): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  }
}

/**
 * Custom hook to manage modal state with browser history integration.
 * When a modal opens, it pushes a history state.
 * When the user presses Back, the modal closes.
 */
function useModalWithHistory(modalId: ModalId) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Integrate with browser history
  useModalHistory(modalId, isOpen, close);

  return { isOpen, open, close };
}

export default function HomePageContent() {
  // Initialize active tab from localStorage (with SSR safety)
  const [activeTab, setActiveTab] = useState<TabId>('dayToDay');
  const [isTabHydrated, setIsTabHydrated] = useState(false);

  // Load saved tab on mount (client-side only)
  useEffect(() => {
    const savedTab = loadActiveTab();
    setActiveTab(savedTab);
    setIsTabHydrated(true);
  }, []);
  
  // Initialize the history guard to prevent accidental exit
  const { markUserNavigation } = useHistoryGuard(true);
  
  // Simple menu state (no history integration to avoid race conditions)
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Modal states using history-integrated hooks (only for actual modals, not dropdown menu)
  const exportModal = useModalWithHistory('export');
  const clearModal = useModalWithHistory('clear');
  const importModal = useModalWithHistory('import');
  const categoryModal = useModalWithHistory('categories');
  const aiModal = useModalWithHistory('ai');
  
  const { state, dispatch } = useAppState();

  // Mark user navigation when tab changes (intentional in-app navigation)
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    saveActiveTab(tab); // Persist to localStorage
    markUserNavigation();
  }, [markUserNavigation]);

  const handleMenuClick = () => {
    setIsMenuOpen(true);
  };

  const handleExport = () => {
    try {
      // Export JSON backup (includes all items, actions, and categories)
      const jsonData = exportState();
      const jsonBlob = new Blob([jsonData], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `mcadence-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);
      URL.revokeObjectURL(jsonUrl);
    } catch (error) {
      console.error('Export failed:', error);
    }
    setIsMenuOpen(false);
  };

  const handleImport = ({ state: importedState, mode }: { state: any; mode: 'combine' | 'overwrite' }) => {
    // Use imported categories if available, otherwise keep existing or use defaults
    const importedCategories = importedState.categories && importedState.categories.length > 0
      ? importedState.categories
      : DEFAULT_CATEGORIES;
    
    if (mode === 'overwrite') {
      // Replace entire state including categories
      const finalState = {
        items: importedState.items || [],
        actions: importedState.actions || [],
        categories: importedCategories
      };
      dispatch({ type: 'LOAD_STATE', payload: finalState });
      saveStateImmediate(finalState);
      saveCategories(importedCategories); // Also save to separate categories storage
    } else {
      // Combine with existing state
      const existingItems = state.items;
      const existingActions = state.actions;
      const existingCategories = state.categories && state.categories.length > 0
        ? state.categories
        : DEFAULT_CATEGORIES;
      
      // For items, replace by ID if exists, otherwise add new
      const combinedItems = [...existingItems];
      (importedState.items || []).forEach((importedItem: any) => {
        const existingIndex = combinedItems.findIndex(item => item.id === importedItem.id);
        if (existingIndex >= 0) {
          combinedItems[existingIndex] = importedItem;
        } else {
          combinedItems.push(importedItem);
        }
      });
      
      // For actions, just append all imported actions
      const combinedActions = [...existingActions, ...(importedState.actions || [])];
      
      // For categories, merge by ID
      const combinedCategories = [...existingCategories];
      (importedCategories || []).forEach((importedCat: Category) => {
        const existingIndex = combinedCategories.findIndex(c => c.id === importedCat.id);
        if (existingIndex >= 0) {
          combinedCategories[existingIndex] = importedCat;
        } else {
          combinedCategories.push(importedCat);
        }
      });
      
      const finalState = {
        items: combinedItems,
        actions: combinedActions,
        categories: combinedCategories
      };
      
      dispatch({ type: 'LOAD_STATE', payload: finalState });
      saveStateImmediate(finalState);
      saveCategories(combinedCategories);
    }
    
    // Mark as user navigation after import
    markUserNavigation();
  };

  const handleClearData = () => {
    // Clear localStorage first
    clearState();
    
    // Clear React state immediately so UI updates
    dispatch({
      type: 'LOAD_STATE',
      payload: { items: [], actions: [], categories: DEFAULT_CATEGORIES }
    });
    
    // Close the modal and then reload to ensure clean state
    clearModal.close();
    
    // Small delay to ensure state is saved, then reload
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleSaveCategories = (categories: Category[]) => {
    // Save to separate storage key
    saveCategories(categories);
    
    // Update state with new categories
    const updatedState = {
      ...state,
      categories
    };
    dispatch({ type: 'LOAD_STATE', payload: updatedState });
    saveStateImmediate(updatedState);
    
    // Mark as user navigation after category change
    markUserNavigation();
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dayToDay':
        return <DayToDayTab />;
      case 'hitMyGoal':
        return <HitMyGoalTab />;
      case 'spendMyTime':
        return <SpendMyTimeTab />;
      default:
        return <DayToDayTab />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onMenuClick={handleMenuClick}
      onAIClick={() => aiModal.open()}
    >
      {renderActiveTab()}

      {/* Menu Dropdown */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute right-4 top-16 w-64 bg-white rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Menu</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  exportModal.open();
                }}
                className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Export Data
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  importModal.open();
                }}
                className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Import Data
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  categoryModal.open();
                }}
                className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Edit Categories
              </button>
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 px-3 py-1">Danger Zone</div>
              </div>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  clearModal.open();
                }}
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear All Data
              </button>
              <div className="pt-2 border-t border-gray-200">
                <div className="text-sm text-gray-500 px-3">
                  Items: {state.items.length} | Actions: {state.actions.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Confirmation */}
      <ConfirmDialog
        isOpen={exportModal.isOpen}
        onClose={() => exportModal.close()}
        onConfirm={handleExport}
        title="Export Data"
        message="Export your data as a JSON backup file?"
      />

      {/* Clear Data Confirmation */}
      <ConfirmDialog
        isOpen={clearModal.isOpen}
        onClose={() => clearModal.close()}
        onConfirm={handleClearData}
        title="Clear All Data"
        message="Are you sure you want to delete all items and actions? This cannot be undone."
        confirmText="Clear All"
        danger={true}
      />

      {/* Import Modal */}
      <ImportExportModal
        isOpen={importModal.isOpen}
        onClose={() => importModal.close()}
        onImport={handleImport}
      />

      {/* Category Editor Modal */}
      <CategoryEditorModal
        isOpen={categoryModal.isOpen}
        onClose={() => categoryModal.close()}
        categories={state.categories && state.categories.length > 0 ? state.categories : DEFAULT_CATEGORIES}
        onSave={handleSaveCategories}
      />

      {/* AI Panel - Lazy loaded for performance */}
      {aiModal.isOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading AI Panel...</p>
            </div>
          </div>
        }>
          <AiPanel
            isOpen={aiModal.isOpen}
            onClose={() => aiModal.close()}
          />
        </Suspense>
      )}

    </Layout>
  );
}
