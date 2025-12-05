'use client';

import { useState } from 'react';
import { useAppState } from '@/lib/state';
import { ChecklistItemForm, isChecklistItem } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/Modal';
import { DEFAULT_COLOR, PRESET_COLORS } from '@/lib/constants';

export function HitMyGoalTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [itemToArchive, setItemToArchive] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<ChecklistItemForm>({
    title: '',
    category: '',
    color: DEFAULT_COLOR.value,
  });

  const { getItemsByTab, addChecklistItem, toggleChecklistItem, archiveItem, deleteItem } = useAppState();

  const items = getItemsByTab('hitMyGoal');
  const archivedItems = getItemsByTab('hitMyGoal', true).filter(item => item.status === 'archived');

  const handleAddItem = () => {
    if (formData.title.trim()) {
      addChecklistItem('hitMyGoal', formData);
      setFormData({ title: '', category: '', color: DEFAULT_COLOR.value });
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

  return (
    <div>
      {/* Header with Add button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Goals & Challenges</h2>
        <div className="flex gap-2">
          {archivedItems.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setShowArchive(!showArchive)}
            >
              {showArchive ? 'Active' : `Archived (${archivedItems.length})`}
            </Button>
          )}
          <Button onClick={() => setShowAddModal(true)}>
            + Add Goal
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
                  {item.category && (
                    <span className="text-sm text-gray-500">{item.category}</span>
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
          {items.map((item) => (
            isChecklistItem(item) && (
              <div
                key={item.id}
                className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm swipe-hint"
                style={{ borderLeftColor: item.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.isDone}
                    onChange={() => toggleChecklistItem(item.id)}
                    className="h-5 w-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <h3 className={`font-medium ${item.isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {item.title}
                    </h3>
                    {item.category && (
                      <span className="text-sm text-gray-500">{item.category}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
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
            )
          ))}
          {items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No goals yet</p>
              <Button onClick={() => setShowAddModal(true)}>
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
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Optional category"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-8 h-8 rounded-full border-2 ${
                    formData.color === color.value ? 'border-gray-900' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
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
    </div>
  );
}
