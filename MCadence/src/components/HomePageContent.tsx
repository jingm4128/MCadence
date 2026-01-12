'use client';

import { useState } from 'react';
import { TabId } from '@/lib/types';
import { useAppState } from '@/lib/state';
import { Layout } from '@/components/layout/Layout';
import { DayToDayTab } from '@/components/tabs/DayToDayTab';
import { HitMyGoalTab } from '@/components/tabs/HitMyGoalTab';
import { SpendMyTimeTab } from '@/components/tabs/SpendMyTimeTab';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ImportExportModal } from '@/components/ui/ImportExportModal';
import { exportState, clearState, saveStateImmediate } from '@/lib/storage';
import { exportItemsToCSV, exportActionsToCSV, downloadCSV } from '@/lib/csvUtils';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

export default function HomePageContent() {
  const [activeTab, setActiveTab] = useState<TabId>('dayToDay');
  const [showMenu, setShowMenu] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const { state, dispatch } = useAppState();

  const handleMenuClick = () => {
    setShowMenu(true);
  };

  const handleExport = () => {
    try {
      // Export JSON backup
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

      // Export CSV files
      const itemsCSV = exportItemsToCSV(state.items);
      const actionsCSV = exportActionsToCSV(state.actions);
      
      downloadCSV(itemsCSV, `mcadence_items_${new Date().toISOString().split('T')[0]}.csv`);
      downloadCSV(actionsCSV, `mcadence_actions_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Export failed:', error);
    }
    setShowMenu(false);
  };

  const handleImport = ({ state: importedState, mode }: { state: any; mode: 'combine' | 'overwrite' }) => {
    if (mode === 'overwrite') {
      // Replace entire state
      const finalState = {
        ...importedState,
        categories: DEFAULT_CATEGORIES // Ensure we always have default categories
      };
      dispatch({ type: 'LOAD_STATE', payload: finalState });
      saveStateImmediate(finalState);
    } else {
      // Combine with existing state
      const existingItems = state.items;
      const existingActions = state.actions;
      
      // For items, replace by ID if exists, otherwise add new
      const combinedItems = [...existingItems];
      importedState.items.forEach((importedItem: any) => {
        const existingIndex = combinedItems.findIndex(item => item.id === importedItem.id);
        if (existingIndex >= 0) {
          combinedItems[existingIndex] = importedItem;
        } else {
          combinedItems.push(importedItem);
        }
      });
      
      // For actions, just append all imported actions
      const combinedActions = [...existingActions, ...importedState.actions];
      
      const finalState = {
        items: combinedItems,
        actions: combinedActions,
        categories: DEFAULT_CATEGORIES
      };
      
      dispatch({ type: 'LOAD_STATE', payload: finalState });
      saveStateImmediate(finalState);
    }
  };

  const handleClearData = () => {
    clearState();
    window.location.reload();
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
    </Layout>
  );
}
