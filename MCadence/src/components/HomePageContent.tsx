'use client';

import { useState, lazy, Suspense } from 'react';
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

// Lazy load AiPanel to keep main app fast
const AiPanel = lazy(() => import('@/components/ai/AiPanel'));

export default function HomePageContent() {
  const [activeTab, setActiveTab] = useState<TabId>('dayToDay');
  const [showMenu, setShowMenu] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  
  const { state, dispatch } = useAppState();

  const handleMenuClick = () => {
    setShowMenu(true);
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
    setShowMenu(false);
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
  };

  const handleClearData = () => {
    clearState();
    window.location.reload();
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
      onTabChange={setActiveTab}
      onMenuClick={handleMenuClick}
      onAIClick={() => setShowAiPanel(true)}
    >
      {renderActiveTab()}

      {/* Menu Modal */}
      {showMenu && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowMenu(false)}>
          <div className="absolute right-4 top-16 w-64 bg-white rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-4">Menu</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowExportConfirm(true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Export Data
              </button>
              <button
                onClick={() => {
                  setShowImportModal(true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Import Data
              </button>
              <button
                onClick={() => {
                  setShowCategoryEditor(true);
                  setShowMenu(false);
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
                  setShowClearConfirm(true);
                  setShowMenu(false);
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
        isOpen={showExportConfirm}
        onClose={() => setShowExportConfirm(false)}
        onConfirm={handleExport}
        title="Export Data"
        message="Export your data as a JSON backup file?"
      />

      {/* Clear Data Confirmation */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearData}
        title="Clear All Data"
        message="Are you sure you want to delete all items and actions? This cannot be undone."
        confirmText="Clear All"
        danger={true}
      />

      {/* Import Modal */}
      <ImportExportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />

      {/* Category Editor Modal */}
      <CategoryEditorModal
        isOpen={showCategoryEditor}
        onClose={() => setShowCategoryEditor(false)}
        categories={state.categories && state.categories.length > 0 ? state.categories : DEFAULT_CATEGORIES}
        onSave={handleSaveCategories}
      />

      {/* AI Panel - Lazy loaded for performance */}
      {showAiPanel && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading AI Panel...</p>
            </div>
          </div>
        }>
          <AiPanel
            isOpen={showAiPanel}
            onClose={() => setShowAiPanel(false)}
          />
        </Suspense>
      )}

    </Layout>
  );
}
