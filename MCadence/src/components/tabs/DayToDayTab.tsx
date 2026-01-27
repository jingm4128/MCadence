'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '@/lib/state';
import { ChecklistItem, ChecklistItemForm, isChecklistItem, RecurrenceFormSettings, RecurrenceSettings, SwipeAction } from '@/lib/types';
import { DEFAULT_CATEGORY_ID, DEFAULT_TIMEZONE } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, RecurrenceDeleteDialog, NotesEditorModal } from '@/components/ui/Modal';
import { CategorySelector, getCategoryColor, getCategoryIcon, getParentCategoryId, getCategories } from '@/components/ui/CategorySelector';
import { RecurrenceSelector } from '@/components/ui/RecurrenceSelector';
import { TabHeader } from '@/components/ui/TabHeader';
import { SwipeableItem } from '@/components/ui/SwipeableItem';
import { loadSettings, loadSettings as getSettings } from '@/lib/storage';
import { getUrgencyStatus, getUrgencyClasses, formatDueDateDisplay, getCurrentPeriodKey, formatTitleWithPeriod, getPeriodDueDate, UrgencyStatus } from '@/utils/date';

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

// Edit item state (for long press editing)
interface EditItemState {
  itemId: string;
  title: string;
  categoryId: string;
  dueDate: string | null | undefined;
}

// Edit recurrence state
interface EditRecurrenceState {
  itemId: string;
  recurrence: RecurrenceFormSettings | undefined;
  hasExistingRecurrence: boolean;
}

// Edit notes state
interface EditNotesState {
  itemId: string;
  notes: string;
  itemTitle: string;
}

export function DayToDayTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editItemState, setEditItemState] = useState<EditItemState | null>(null);
  const [editRecurrenceState, setEditRecurrenceState] = useState<EditRecurrenceState | null>(null);
  const [editNotesState, setEditNotesState] = useState<EditNotesState | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState<ChecklistItemForm>({
    title: '',
    categoryId: DEFAULT_CATEGORY_ID,
    dueDate: undefined,
    recurrence: undefined,
  });

  const { getItemsByTab, addChecklistItem, toggleChecklistItem, archiveItem, unarchiveItem, deleteItem, deleteRecurringSeries, archiveAllCompletedInTab, updateItem, state } = useAppState();

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
          message: `🎉 Task completed! All ${rec.totalOccurrences} occurrences done!`,
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
      addChecklistItem('dayToDay', formData);
      setFormData({ title: '', categoryId: DEFAULT_CATEGORY_ID, dueDate: undefined, recurrence: undefined });
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
    setToast({ message: 'Item archived', type: 'info' });
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
  }, [archiveItem, deleteItem]);

  // Get the item to be deleted
  const itemToDeleteData = useMemo(() => {
    if (!itemToDelete) return null;
    const allItemsIncludingArchived = getItemsByTab('dayToDay', true);
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
      i.tab === 'dayToDay' &&
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

  // Edit item functions (long press)
  const handleEditItem = (item: ChecklistItem) => {
    setEditItemState({
      itemId: item.id,
      title: item.title,
      categoryId: item.categoryId,
      dueDate: item.dueDate,
    });
  };

  const confirmEditItem = () => {
    if (editItemState) {
      updateItem(editItemState.itemId, {
        title: editItemState.title.trim(),
        categoryId: editItemState.categoryId,
        dueDate: editItemState.dueDate || undefined
      });
      setEditItemState(null);
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
      const allItemsList = getItemsByTab('dayToDay', true);
      const item = allItemsList.find(i => i.id === itemId);
      if (!item || !isChecklistItem(item)) {
        setEditRecurrenceState(null);
        return;
      }
      
      const existingRecurrence = item.recurrence;
      
      if (!recurrence || !recurrence.enabled) {
        // Remove recurrence
        updateItem(itemId, { recurrence: undefined });
      } else {
        // Check if we're converting a non-recurring item to recurring
        const isConvertingToRecurring = !existingRecurrence;
        
        // Get settings for week start day
        const settings = getSettings();
        const weekStartDay = settings.weekStartDay;
        
        // Calculate periodKey and nextDue for recurring items
        const periodKey = getCurrentPeriodKey(recurrence.frequency, undefined, weekStartDay);
        const nextDue = getPeriodDueDate(periodKey);
        
        // Build new recurrence settings
        const newRecurrence: RecurrenceSettings = {
          frequency: recurrence.frequency,
          interval: recurrence.interval || 1,
          totalOccurrences: recurrence.totalOccurrences,
          completedOccurrences: existingRecurrence?.completedOccurrences || 0,
          timezone: recurrence.timezone || DEFAULT_TIMEZONE,
          startDate: existingRecurrence?.startDate || new Date().toISOString(),
          nextDue: nextDue,
        };
        
        if (isConvertingToRecurring) {
          // Converting non-recurring to recurring:
          // - Set baseTitle to preserve original title
          // - Update title with period suffix
          // - Set periodKey for the current period
          // - Clear any explicit dueDate (recurrence.nextDue will be used)
          const baseTitle = item.baseTitle || item.title;
          const newTitle = formatTitleWithPeriod(baseTitle, periodKey);
          
          updateItem(itemId, {
            recurrence: newRecurrence,
            baseTitle: baseTitle,
            title: newTitle,
            periodKey: periodKey,
            dueDate: undefined, // Clear explicit due date when using recurrence
          });
        } else {
          // Just updating existing recurrence settings
          updateItem(itemId, { recurrence: newRecurrence });
        }
      }
      
      setEditRecurrenceState(null);
    }
  };

  // Edit notes functions
  const handleEditNotes = (item: ChecklistItem) => {
    setEditNotesState({
      itemId: item.id,
      notes: item.notes || '',
      itemTitle: item.title,
    });
  };

  const confirmEditNotes = (notes: string) => {
    if (editNotesState) {
      updateItem(editNotesState.itemId, { notes: notes || undefined });
      setEditNotesState(null);
    }
  };

  // Check if there are completed items to archive
  const completedCount = allItems.filter(item =>
    isChecklistItem(item) && item.isDone
  ).length;

  const handleArchiveAllCompleted = () => {
    const count = archiveAllCompletedInTab('dayToDay');
    if (count > 0) {
      setToast({ message: `Archived ${count} completed task${count > 1 ? 's' : ''}`, type: 'info' });
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
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate ${isDone ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                      {item.categoryId && <span className="mr-1">{getCategoryIcon(item.categoryId)}</span>}
                      {item.title}
                      {isDone && <span className="ml-1 text-green-600">✓</span>}
                    </h3>
                    {/* Show recurrence info if available */}
                    {checklistItem?.recurrence && (
                      <div className="flex items-center gap-2 text-xs mt-0.5">
                        <span className="text-gray-400">
                          {checklistItem.recurrence.completedOccurrences}
                          {checklistItem.recurrence.totalOccurrences ? `/${checklistItem.recurrence.totalOccurrences}` : ''} completed
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => unarchiveItem(item.id)}
                      className="text-primary-600 hover:text-primary-800 p-0.5"
                      title="Restore"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-400 hover:text-red-600 p-0.5"
                      title="Delete"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            
            // Calculate urgency - prioritize dueDate, then recurrence nextDue
            const effectiveDueDate = (item.dueDate ?? item.recurrence?.nextDue) ?? undefined;  // Convert null to undefined
            const hasRecurrence = !!item.recurrence;
            const hasDueDate = !!effectiveDueDate;
            const urgencyStatus: UrgencyStatus = hasDueDate
              ? getUrgencyStatus(effectiveDueDate, item.isDone)
              : item.isDone ? 'complete' : 'normal';
            const urgencyClasses = getUrgencyClasses(urgencyStatus);
            const dueDateDisplay = formatDueDateDisplay(effectiveDueDate, item.isDone);
            
            const swipeHandlers = getSwipeHandlers(item.id);
            return (
              <SwipeableItem
                key={item.id}
                onSwipeLeft={swipeHandlers.onSwipeLeft}
                onSwipeRight={swipeHandlers.onSwipeRight}
                onLongPress={() => handleEditItem(item)}
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
                        {/* Due date display - always shown at end of item */}
                        {!item.isDone && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${hasDueDate ? urgencyClasses.badge : 'bg-gray-100 text-gray-500'}`}>
                            {dueDateDisplay}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => handleEditNotes(item)}
                        className={`p-0.5 ${item.notes ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
                        title={item.notes ? "Edit Notes" : "Add Notes"}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
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
              <div className="empty-state-icon">📝</div>
              <p className="text-gray-500">No tasks yet</p>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && formData.title.trim()) {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
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

      {/* Delete Confirmation - Show different dialogs for recurring vs non-recurring items */}
      {isRecurringDelete ? (
        <RecurrenceDeleteDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onDeleteOne={confirmDeleteOne}
          onDeleteAll={confirmDeleteAll}
          title="Delete Recurring Task"
          itemName={itemToDeleteData?.baseTitle}
          seriesCount={recurringSeriesCount}
        />
      ) : (
        <ConfirmDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={confirmDeleteOne}
          title="Delete Task"
          message="Delete this task and all its history? This cannot be undone."
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
                ? 'Modify or remove the recurrence settings for this task.'
                : 'Add recurrence settings to make this a recurring task.'}
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

      {/* Edit Item Modal (Long Press) */}
      <Modal
        isOpen={!!editItemState}
        onClose={() => setEditItemState(null)}
        title="Edit Task"
      >
        {editItemState && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Edit the task title, category, and due date.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title
              </label>
              <input
                type="text"
                value={editItemState.title}
                onChange={(e) => setEditItemState({
                  ...editItemState,
                  title: e.target.value
                })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editItemState.title.trim()) {
                    e.preventDefault();
                    confirmEditItem();
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter task title"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <CategorySelector
                value={editItemState.categoryId}
                onChange={(categoryId) => setEditItemState({
                  ...editItemState,
                  categoryId
                })}
                placeholder="Select category"
              />
            </div>
            {/* Due Date - only show when item has no recurrence */}
            {(() => {
              const item = items.find(i => i.id === editItemState.itemId) ||
                          archivedItems.find(i => i.id === editItemState.itemId);
              const hasRecurrence = item?.recurrence;
              return !hasRecurrence ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={isoToDateInput(editItemState.dueDate)}
                      onChange={(e) => setEditItemState({
                        ...editItemState,
                        dueDate: e.target.value ? dateInputToISO(e.target.value) : undefined
                      })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {editItemState.dueDate && (
                      <button
                        type="button"
                        onClick={() => setEditItemState({ ...editItemState, dueDate: undefined })}
                        className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        title="Clear due date"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Set a due date to track urgency</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Due date is managed by recurrence settings</p>
              );
            })()}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setEditItemState(null)}
              >
                Cancel
              </Button>
              <Button onClick={confirmEditItem}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Notes Editor Modal */}
      <NotesEditorModal
        isOpen={!!editNotesState}
        onClose={() => setEditNotesState(null)}
        onSave={confirmEditNotes}
        notes={editNotesState?.notes || ''}
        itemTitle={editNotesState?.itemTitle}
      />

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
