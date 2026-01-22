'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '@/lib/state';
import { ChecklistItemForm, isChecklistItem, SwipeAction } from '@/lib/types';
import { DEFAULT_CATEGORY_ID } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/Modal';
import { CategorySelector, getCategoryColor, getCategoryIcon, getParentCategoryId, getCategories } from '@/components/ui/CategorySelector';
import { TabHeader } from '@/components/ui/TabHeader';
import { SwipeableItem } from '@/components/ui/SwipeableItem';
import { loadSettings } from '@/lib/storage';
import { getUrgencyStatus, getUrgencyClasses, formatTimeUntilDue, formatDateYMD, UrgencyStatus } from '@/utils/date';

export function DayToDayTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState<ChecklistItemForm>({
    title: '',
    categoryId: DEFAULT_CATEGORY_ID,
    dueDate: undefined,
  });

  const { getItemsByTab, addChecklistItem, toggleChecklistItem, archiveItem, unarchiveItem, deleteItem, archiveAllCompletedInTab, state } = useAppState();

  // Get parent categories for filter dropdown - ensure we use getCategories() which loads from storage
  const categories = (state?.categories && state.categories.length > 0) ? state.categories : getCategories();
  const allItems = getItemsByTab('dayToDay');
  const allArchivedItems = getItemsByTab('dayToDay', true).filter(item => item.isArchived);

  // Filter items by category
  const items = categoryFilter === 'all'
    ? allItems
    : allItems.filter(item => getParentCategoryId(item.categoryId) === categoryFilter);
  const archivedItems = categoryFilter === 'all'
    ? allArchivedItems
    : allArchivedItems.filter(item => getParentCategoryId(item.categoryId) === categoryFilter);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleAddItem = () => {
    if (formData.title.trim()) {
      addChecklistItem('dayToDay', formData);
      setFormData({ title: '', categoryId: DEFAULT_CATEGORY_ID, dueDate: undefined });
      setShowAddModal(false);
    }
  };

  // Helper to convert date input value to ISO string (end of day)
  const dateInputToISO = (dateStr: string): string => {
    // Parse YYYY-MM-DD and set to end of day in local time
    const date = new Date(dateStr + 'T23:59:59');
    return date.toISOString();
  };

  // Helper to convert ISO string to date input value
  const isoToDateInput = (isoStr: string | null | undefined): string => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toISOString().split('T')[0];
  };

  const handleArchive = (id: string) => {
    archiveItem(id);
    setToastMessage('Archived, go to archived to recover');
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  // Get swipe handlers based on settings
  const getSwipeHandlers = useCallback((id: string) => {
    const settings = loadSettings();
    const swipeConfig = settings.swipeConfig.dayToDay;
    
    const executeAction = (action: SwipeAction) => {
      if (action === 'delete') {
        handleDelete(id);
      } else {
        handleArchive(id);
      }
    };
    
    return {
      onSwipeLeft: () => executeAction(swipeConfig.left),
      onSwipeRight: () => executeAction(swipeConfig.right),
      leftLabel: swipeConfig.left === 'delete' ? 'Delete' : 'Archive',
      rightLabel: swipeConfig.right === 'delete' ? 'Delete' : 'Archive',
      leftColor: swipeConfig.left === 'delete' ? 'bg-red-500' : 'bg-blue-500',
      rightColor: swipeConfig.right === 'delete' ? 'bg-red-500' : 'bg-blue-500',
    };
  }, []);

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  // Check if there are completed items to archive
  const completedCount = allItems.filter(item =>
    isChecklistItem(item) && item.isDone
  ).length;

  const handleArchiveAllCompleted = () => {
    const count = archiveAllCompletedInTab('dayToDay');
    if (count > 0) {
      setToastMessage(`Archived ${count} completed item${count > 1 ? 's' : ''}`);
    }
  };

  return (
    <div>
      <TabHeader
        archivedCount={allArchivedItems.length}
        showArchive={showArchive}
        onToggleArchive={() => setShowArchive(!showArchive)}
        completedCount={completedCount}
        onArchiveAllCompleted={handleArchiveAllCompleted}
        onAdd={() => setShowAddModal(true)}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      {/* Items List */}
      {showArchive ? (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">Archived tasks</p>
          {archivedItems.map((item) => {
            const checklistItem = isChecklistItem(item) ? item : null;
            const isDone = checklistItem?.isDone ?? false;
            return (
              <div
                key={item.id}
                className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 opacity-70"
                style={{ borderLeftColor: getCategoryColor(item.categoryId), borderLeftWidth: "4px" }}
              >
                <div className="flex items-center gap-2">
                  {/* Done/Open status indicator */}
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isDone
                      ? 'bg-green-100 border-green-500 text-green-600'
                      : 'bg-gray-100 border-gray-400'
                  }`}>
                    {isDone && (
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                      {item.categoryId && <span className="mr-1">{getCategoryIcon(item.categoryId)}</span>}
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => unarchiveItem(item.id)}
                      className="text-primary-600 hover:text-primary-800 p-1"
                      title="Restore"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-400 hover:text-red-600 p-1"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {archivedItems.length === 0 && (
            <p className="text-center text-gray-500 py-8">No archived tasks</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            if (!isChecklistItem(item)) return null;
            const swipeHandlers = getSwipeHandlers(item.id);
            
            // Calculate urgency for items with due date
            const dueDate = item.dueDate ?? undefined;  // Convert null to undefined for type compatibility
            const hasDueDate = !!dueDate;
            const urgencyStatus: UrgencyStatus = hasDueDate
              ? getUrgencyStatus(dueDate, item.isDone)
              : item.isDone ? 'complete' : 'normal';
            const urgencyClasses = getUrgencyClasses(urgencyStatus);
            const timeUntilDue = hasDueDate ? formatTimeUntilDue(dueDate) : '';
            
            return (
              <SwipeableItem
                key={item.id}
                onSwipeLeft={swipeHandlers.onSwipeLeft}
                onSwipeRight={swipeHandlers.onSwipeRight}
                leftLabel={swipeHandlers.leftLabel}
                rightLabel={swipeHandlers.rightLabel}
                leftColor={swipeHandlers.leftColor}
                rightColor={swipeHandlers.rightColor}
              >
                <div
                  className={`bg-white px-3 py-1.5 rounded-lg border shadow-sm category-transition hover-lift ${
                    urgencyStatus === 'overdue' || urgencyStatus === 'urgent'
                      ? `${urgencyClasses.border} ${urgencyClasses.bg}`
                      : urgencyStatus === 'warning'
                      ? `${urgencyClasses.border} ${urgencyClasses.bg}`
                      : 'border-gray-200'
                  }`}
                  style={{ borderLeftColor: getCategoryColor(item.categoryId), borderLeftWidth: "4px" }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.isDone}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className={`text-sm font-medium truncate ${
                          item.isDone
                            ? 'text-gray-500 line-through'
                            : urgencyStatus === 'overdue' || urgencyStatus === 'urgent'
                            ? urgencyClasses.text
                            : 'text-gray-900'
                        }`}>
                          {item.categoryId && <span className="mr-1">{getCategoryIcon(item.categoryId)}</span>}
                          {item.title}
                        </h3>
                        {/* Time left badge for items with due date */}
                        {hasDueDate && timeUntilDue && !item.isDone && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${urgencyClasses.badge}`}>
                            {timeUntilDue}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </SwipeableItem>
            );
          })}
          {items.length === 0 && (
            <div className="text-center py-12 empty-state">
              <div className="empty-state-icon">📝</div>
              <p className="text-gray-500 mb-4">No tasks yet</p>
              <Button onClick={() => setShowAddModal(true)} className="btn-press">
                Add your first task
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Task">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent form-input"
              placeholder="Enter task title"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <CategorySelector
              value={formData.categoryId}
              onChange={(categoryId) => setFormData({ ...formData, categoryId })}
              placeholder="Select category"
            />
          </div>
          
          {/* Due Date (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date (optional)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={isoToDateInput(formData.dueDate)}
                onChange={(e) => setFormData({
                  ...formData,
                  dueDate: e.target.value ? dateInputToISO(e.target.value) : null
                })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent form-input"
              />
              {formData.dueDate && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, dueDate: null })}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="Clear due date"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Leave empty for no due date</p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowAddModal(false)}
              className="btn-press"
            >
              Cancel
            </Button>
            <Button onClick={handleAddItem} className="btn-press">
              Add Task
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Task"
        message="Delete this task and all its history? This cannot be undone."
        confirmText="Delete"
        danger={true}
      />

      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
