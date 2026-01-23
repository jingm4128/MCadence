'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '@/lib/state';
import { ChecklistItem, ChecklistItemForm, isChecklistItem, RecurrenceFormSettings, RecurrenceSettings, SwipeAction } from '@/lib/types';
import { DEFAULT_CATEGORY_ID } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, RecurrenceDeleteDialog } from '@/components/ui/Modal';
import { CategorySelector, getCategoryColor, getCategoryIcon, getParentCategoryId, getCategories } from '@/components/ui/CategorySelector';
import { RecurrenceSelector, getRecurrenceDisplayText, getSavedRecurrenceDisplayText } from '@/components/ui/RecurrenceSelector';
import { TabHeader } from '@/components/ui/TabHeader';
import { SwipeableItem } from '@/components/ui/SwipeableItem';
import { getUrgencyStatus, getUrgencyClasses, formatTimeUntilDue, UrgencyStatus } from '@/utils/date';
import { loadSettings } from '@/lib/storage';

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
    }`}>
      {message}
    </div>
  );
}

// Edit recurrence state
interface EditRecurrenceState {
  itemId: string;
  recurrence: RecurrenceFormSettings | undefined;
  hasExistingRecurrence: boolean;
}

export function HitMyGoalTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editRecurrenceState, setEditRecurrenceState] = useState<EditRecurrenceState | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState<ChecklistItemForm>({
    title: '',
    categoryId: DEFAULT_CATEGORY_ID,
    dueDate: undefined,
    recurrence: undefined,
  });

  // Helper to convert date input value to ISO string (end of day)
  const dateInputToISO = (dateStr: string): string => {
    const date = new Date(dateStr + 'T23:59:59');
    return date.toISOString();
  };

  // Helper to convert ISO string to date input value
  const isoToDateInput = (isoStr: string | null | undefined): string => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toISOString().split('T')[0];
  };

  const { getItemsByTab, addChecklistItem, toggleChecklistItem, archiveItem, unarchiveItem, deleteItem, deleteRecurringSeries, updateItem, archiveAllCompletedInTab, state } = useAppState();

  // Get parent categories for filter dropdown - ensure we use getCategories() which loads from storage
  const categories = (state?.categories && state.categories.length > 0) ? state.categories : getCategories();
  const allItems = getItemsByTab('hitMyGoal');
  const allArchivedItems = getItemsByTab('hitMyGoal', true).filter(item => item.isArchived);

  // Filter items by category
  const items = categoryFilter === 'all'
    ? allItems
    : allItems.filter(item => getParentCategoryId(item.categoryId) === categoryFilter);
  const archivedItems = categoryFilter === 'all'
    ? allArchivedItems
    : allArchivedItems.filter(item => getParentCategoryId(item.categoryId) === categoryFilter);

  // Custom toggle handler with toast notification
  const handleToggle = (item: ChecklistItem) => {
    const hasRecurrence = !!item.recurrence;
    
    if (hasRecurrence && !item.isDone) {
      const rec = item.recurrence!;
      const newCount = rec.completedOccurrences + 1;
      const reachedLimit = rec.totalOccurrences !== null && newCount >= rec.totalOccurrences;
      
      toggleChecklistItem(item.id);
      
      if (reachedLimit) {
        setToast({
          message: `🎉 Goal completed! All ${rec.totalOccurrences} occurrences done!`,
          type: 'success'
        });
      } else {
        const remaining = rec.totalOccurrences ? `${rec.totalOccurrences - newCount} left` : 'recurring';
        setToast({
          message: `✓ Completed! Reset for next ${rec.frequency} cycle (${remaining})`,
          type: 'info'
        });
      }
    } else {
      toggleChecklistItem(item.id);
    }
  };

  const handleAddItem = () => {
    if (formData.title.trim()) {
      addChecklistItem('hitMyGoal', formData);
      setFormData({ title: '', categoryId: DEFAULT_CATEGORY_ID, dueDate: undefined, recurrence: undefined });
      setShowAddModal(false);
    }
  };

  const handleArchive = (id: string) => {
    archiveItem(id);
    setToast({ message: 'Archived, go to archived to recover', type: 'info' });
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  // Get swipe handlers based on settings
  const getSwipeHandlers = useCallback((id: string) => {
    const settings = loadSettings();
    const swipeConfig = settings.swipeConfig.hitMyGoal;
    
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

  // Get the item to be deleted
  const itemToDeleteData = useMemo(() => {
    if (!itemToDelete) return null;
    const allItemsIncludingArchived = getItemsByTab('hitMyGoal', true);
    return allItemsIncludingArchived.find(i => i.id === itemToDelete) || null;
  }, [itemToDelete, getItemsByTab]);

  // Check if the item being deleted is a recurring item
  const isRecurringDelete = useMemo(() => {
    return itemToDeleteData?.baseTitle && itemToDeleteData?.recurrence;
  }, [itemToDeleteData]);

  // Get count of items in the recurring series
  const recurringSeriesCount = useMemo(() => {
    if (!itemToDeleteData?.baseTitle) return 0;
    return state.items.filter(i =>
      i.baseTitle === itemToDeleteData.baseTitle &&
      i.tab === 'hitMyGoal' &&
      !i.isDeleted
    ).length;
  }, [itemToDeleteData, state.items]);

  const confirmDeleteOne = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  const confirmDeleteAll = () => {
    if (itemToDelete) {
      deleteRecurringSeries(itemToDelete);
      setItemToDelete(null);
    }
  };

  // Edit recurrence functions
  const handleEditRecurrence = (item: ChecklistItem) => {
    const existingRecurrence = item.recurrence;
    setEditRecurrenceState({
      itemId: item.id,
      recurrence: existingRecurrence ? {
        enabled: true,
        frequency: existingRecurrence.frequency,
        interval: existingRecurrence.interval || 1,
        totalOccurrences: existingRecurrence.totalOccurrences,
        timezone: existingRecurrence.timezone,
      } : undefined,
      hasExistingRecurrence: !!existingRecurrence,
    });
  };

  const confirmEditRecurrence = () => {
    if (editRecurrenceState) {
      const { itemId, recurrence } = editRecurrenceState;
      
      // Find the item to preserve existing recurrence data
      const allItems = getItemsByTab('hitMyGoal', true);
      const item = allItems.find(i => i.id === itemId);
      const existingRecurrence = item && isChecklistItem(item) ? item.recurrence : undefined;
      
      if (!recurrence || !recurrence.enabled) {
        // Remove recurrence
        updateItem(itemId, { recurrence: undefined });
      } else {
        // Update recurrence - preserve existing completedOccurrences
        const newRecurrence: RecurrenceSettings = {
          frequency: recurrence.frequency,
          interval: recurrence.interval || 1,
          totalOccurrences: recurrence.totalOccurrences,
          completedOccurrences: existingRecurrence?.completedOccurrences || 0,
          timezone: recurrence.timezone,
          startDate: existingRecurrence?.startDate || new Date().toISOString(),
          nextDue: existingRecurrence?.nextDue || new Date().toISOString(),
        };
        
        updateItem(itemId, { recurrence: newRecurrence });
      }
      
      setEditRecurrenceState(null);
    }
  };

  // Check if there are completed items to archive
  const completedCount = allItems.filter(item =>
    isChecklistItem(item) && item.isDone
  ).length;

  const handleArchiveAllCompleted = () => {
    const count = archiveAllCompletedInTab('hitMyGoal');
    if (count > 0) {
      setToast({ message: `Archived ${count} completed goal${count > 1 ? 's' : ''}`, type: 'info' });
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
          <p className="text-xs text-gray-500 mb-2">Archived goals</p>
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
                    {/* Show recurrence info if available */}
                    {checklistItem?.recurrence && (
                      <span className="text-xs text-gray-400">
                        {checklistItem.recurrence.completedOccurrences}
                        {checklistItem.recurrence.totalOccurrences ? `/${checklistItem.recurrence.totalOccurrences}` : ''} completed
                      </span>
                    )}
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
            <p className="text-center text-gray-500 py-8">No archived goals</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            if (!isChecklistItem(item)) return null;
            
            // Calculate urgency - prioritize dueDate, then recurrence nextDue
            const effectiveDueDate = (item.dueDate ?? item.recurrence?.nextDue) ?? undefined;  // Convert null to undefined
            const hasRecurrence = !!item.recurrence;
            const hasDueDate = !!effectiveDueDate;
            const urgencyStatus: UrgencyStatus = hasDueDate
              ? getUrgencyStatus(effectiveDueDate, item.isDone)
              : item.isDone ? 'complete' : 'normal';
            const urgencyClasses = getUrgencyClasses(urgencyStatus);
            const timeUntilDue = hasDueDate ? formatTimeUntilDue(effectiveDueDate) : '';
            
            const swipeHandlers = getSwipeHandlers(item.id);
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
                  style={{ borderLeftColor: getCategoryColor(item.categoryId), borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.isDone}
                      onChange={() => handleToggle(item)}
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
                        {/* Time left badge for items with due dates */}
                        {hasDueDate && timeUntilDue && !item.isDone && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${urgencyClasses.badge}`}>
                            {timeUntilDue}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => handleEditRecurrence(item)}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                        title="Edit Recurrence"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </SwipeableItem>
            );
          })}
          {items.length === 0 && (
            <div className="text-center py-12 empty-state">
              <div className="empty-state-icon">🎯</div>
              <p className="text-gray-500 mb-4">No goals yet</p>
              <Button onClick={() => setShowAddModal(true)} className="btn-press">
                Add your first goal
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Goal">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Goal Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter goal title"
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
          
          {/* Due Date - only show when no recurrence is set */}
          {!formData.recurrence?.enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={isoToDateInput(formData.dueDate)}
                  onChange={(e) => setFormData({
                    ...formData,
                    dueDate: e.target.value ? dateInputToISO(e.target.value) : undefined
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {formData.dueDate && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, dueDate: undefined })}
                    className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    title="Clear due date"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Set a due date to track urgency</p>
            </div>
          )}

          {/* Recurrence Settings */}
          <div>
            <RecurrenceSelector
              value={formData.recurrence}
              onChange={(recurrence) => setFormData({ ...formData, recurrence, dueDate: recurrence?.enabled ? undefined : formData.dueDate })}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddItem}>
              Add Goal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation - Show different dialogs for recurring vs non-recurring items */}
      {isRecurringDelete ? (
        <RecurrenceDeleteDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onDeleteOne={confirmDeleteOne}
          onDeleteAll={confirmDeleteAll}
          title="Delete Recurring Goal"
          itemName={itemToDeleteData?.baseTitle}
          seriesCount={recurringSeriesCount}
        />
      ) : (
        <ConfirmDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={confirmDeleteOne}
          title="Delete Goal"
          message="Delete this goal and all its history? This cannot be undone."
          confirmText="Delete"
          danger={true}
        />
      )}

      {/* Edit Recurrence Modal */}
      <Modal
        isOpen={!!editRecurrenceState}
        onClose={() => setEditRecurrenceState(null)}
        title="Edit Recurrence"
      >
        {editRecurrenceState && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {editRecurrenceState.hasExistingRecurrence
                ? 'Modify or remove the recurrence settings for this goal.'
                : 'Add recurrence settings to make this a recurring goal.'}
            </p>
            <RecurrenceSelector
              value={editRecurrenceState.recurrence}
              onChange={(recurrence) => setEditRecurrenceState({
                ...editRecurrenceState,
                recurrence
              })}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setEditRecurrenceState(null)}
              >
                Cancel
              </Button>
              <Button onClick={confirmEditRecurrence}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
