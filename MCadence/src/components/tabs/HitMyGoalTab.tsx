'use client';

import { useState, useEffect } from 'react';
import { useAppState } from '@/lib/state';
import { ChecklistItem, ChecklistItemForm, isChecklistItem, RecurrenceFormSettings, RecurrenceSettings } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/Modal';
import { CategorySelector, getCategoryColor, getCategoryIcon, getCategoryDisplayName } from '@/components/ui/CategorySelector';
import { RecurrenceSelector, getRecurrenceDisplayText, getSavedRecurrenceDisplayText } from '@/components/ui/RecurrenceSelector';
import { getUrgencyStatus, getUrgencyClasses, formatTimeUntilDue, UrgencyStatus } from '@/utils/date';

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
  const [itemToArchive, setItemToArchive] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editRecurrenceState, setEditRecurrenceState] = useState<EditRecurrenceState | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [formData, setFormData] = useState<ChecklistItemForm>({
    title: '',
    categoryId: '',
    recurrence: undefined,
  });

  const { getItemsByTab, addChecklistItem, toggleChecklistItem, archiveItem, deleteItem, updateItem, state } = useAppState();

  const items = getItemsByTab('hitMyGoal');
  const archivedItems = getItemsByTab('hitMyGoal', true).filter(item => item.isArchived);

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
      setFormData({ title: '', categoryId: '', recurrence: undefined });
      setShowAddModal(false);
    }
  };

  const handleArchive = (id: string) => {
    setItemToArchive(id);
  };

  const confirmArchive = () => {
    if (itemToArchive) {
      archiveItem(itemToArchive);
      setItemToArchive(null);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete);
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

  return (
    <div>
      {/* Header with Add button - Title removed as requested */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {archivedItems.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setShowArchive(!showArchive)}
            >
              {showArchive ? 'Active' : `Archived (${archivedItems.length})`}
            </Button>
          )}
          <Button onClick={() => setShowAddModal(true)} className="font-bold text-lg">
            +
          </Button>
        </div>
      </div>

      {/* Items List */}
      {showArchive ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 mb-4">Archived goals</p>
          {archivedItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-lg border border-gray-200 opacity-60"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-700 line-through">{item.title}</h3>
                  {item.categoryId && (
                    <span className="text-sm text-gray-500">{item.categoryId}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {archivedItems.length === 0 && (
            <p className="text-center text-gray-500 py-8">No archived goals</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            if (!isChecklistItem(item)) return null;
            
            // Calculate urgency for recurring items
            const hasRecurrence = !!item.recurrence;
            const urgencyStatus: UrgencyStatus = hasRecurrence
              ? getUrgencyStatus(item.recurrence?.nextDue, item.isDone)
              : item.isDone ? 'complete' : 'normal';
            const urgencyClasses = getUrgencyClasses(urgencyStatus);
            const timeUntilDue = hasRecurrence ? formatTimeUntilDue(item.recurrence?.nextDue) : '';
            
            return (
              <div
                key={item.id}
                className={`bg-white p-4 rounded-lg border shadow-sm swipe-hint category-transition hover-lift ${
                  urgencyStatus === 'overdue' || urgencyStatus === 'urgent'
                    ? `${urgencyClasses.border} ${urgencyClasses.bg}`
                    : urgencyStatus === 'warning'
                    ? `${urgencyClasses.border} ${urgencyClasses.bg}`
                    : 'border-gray-200'
                }`}
                style={{ borderLeftColor: getCategoryColor(item.categoryId), borderLeftWidth: '4px' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={item.isDone}
                    onChange={() => handleToggle(item)}
                    className="h-5 w-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${
                        item.isDone
                          ? 'text-gray-500 line-through'
                          : urgencyStatus === 'overdue' || urgencyStatus === 'urgent'
                          ? urgencyClasses.text
                          : 'text-gray-900'
                      }`}>
                        {item.title}
                      </h3>
                      {/* Time left badge for recurring items */}
                      {hasRecurrence && timeUntilDue && !item.isDone && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${urgencyClasses.badge}`}>
                          {timeUntilDue}
                        </span>
                      )}
                    </div>
                    {item.categoryId && (
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <span>{getCategoryIcon(item.categoryId)}</span>
                        {getCategoryDisplayName(item.categoryId)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditRecurrence(item)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title="Edit Recurrence"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleArchive(item.id)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title="Archive"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
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
              Category
            </label>
            <CategorySelector
              value={formData.categoryId}
              onChange={(categoryId) => setFormData({ ...formData, categoryId })}
              placeholder="Optional category"
            />
          </div>
          
          {/* Recurrence Settings */}
          <div>
            <RecurrenceSelector
              value={formData.recurrence}
              onChange={(recurrence) => setFormData({ ...formData, recurrence })}
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

      {/* Archive Confirmation */}
      <ConfirmDialog
        isOpen={!!itemToArchive}
        onClose={() => setItemToArchive(null)}
        onConfirm={confirmArchive}
        title="Archive Goal"
        message="Archive this goal? You can restore it from archived view."
        confirmText="Archive"
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Goal"
        message="Delete this goal and all its history? This cannot be undone."
        confirmText="Delete"
        danger={true}
      />

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
