'use client';

import { useState } from 'react';
import { Category, Subcategory } from '@/lib/types';
import { PRESET_COLORS } from '@/lib/constants';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { generateId } from '@/utils/uuid';

interface CategoryEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSave: (categories: Category[]) => void;
}

// Common emoji icons for categories
const EMOJI_OPTIONS = [
  '📝', '🎯', '⏱️', '💼', '🏠', '🛏️', '🚿', '💄', '🍽️', '🧹',
  '🚗', '👨‍👩‍👧‍👦', '🏥', '📌', '🤱', '🚀', '🔄', '💰', '🤝', '💪',
  '👥', '📚', '🎓', '📋', '🎨', '🗣️', '⚽', '🎮', '🛍️', '🎉',
  '✈️', '👶', '📖', '🧑‍🏫', '❤️', '⭐', '🔥', '✅', '🌟', '🎵',
];

export function CategoryEditorModal({ isOpen, onClose, categories, onSave }: CategoryEditorModalProps) {
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{ sub: Subcategory; parentId: string } | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSubcategory, setShowAddSubcategory] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'category' | 'subcategory'; id: string; parentId?: string } | null>(null);
  
  // Form states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(PRESET_COLORS[0].value);
  const [newSubName, setNewSubName] = useState('');
  const [newSubIcon, setNewSubIcon] = useState('📌');

  const handleSave = () => {
    onSave(localCategories);
    onClose();
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory: Category = {
      id: `cat-${generateId()}`,
      name: newCategoryName.trim(),
      color: newCategoryColor,
      subcategories: [],
    };
    
    setLocalCategories([...localCategories, newCategory]);
    setNewCategoryName('');
    setNewCategoryColor(PRESET_COLORS[0].value);
    setShowAddCategory(false);
  };

  const handleAddSubcategory = (categoryId: string) => {
    if (!newSubName.trim()) return;
    
    const newSub: Subcategory = {
      id: `sub-${generateId()}`,
      name: newSubName.trim(),
      icon: newSubIcon,
      parentId: categoryId,
    };
    
    setLocalCategories(localCategories.map(cat => 
      cat.id === categoryId 
        ? { ...cat, subcategories: [...cat.subcategories, newSub] }
        : cat
    ));
    setNewSubName('');
    setNewSubIcon('📌');
    setShowAddSubcategory(null);
  };

  const handleUpdateCategory = (category: Category) => {
    setLocalCategories(localCategories.map(cat => 
      cat.id === category.id ? category : cat
    ));
    setEditingCategory(null);
  };

  const handleUpdateSubcategory = (subcategory: Subcategory, parentId: string) => {
    setLocalCategories(localCategories.map(cat => 
      cat.id === parentId 
        ? { ...cat, subcategories: cat.subcategories.map(sub => sub.id === subcategory.id ? subcategory : sub) }
        : cat
    ));
    setEditingSubcategory(null);
  };

  const handleDeleteCategory = (categoryId: string) => {
    setLocalCategories(localCategories.filter(cat => cat.id !== categoryId));
    setDeleteConfirm(null);
  };

  const handleDeleteSubcategory = (subcategoryId: string, parentId: string) => {
    setLocalCategories(localCategories.map(cat => 
      cat.id === parentId 
        ? { ...cat, subcategories: cat.subcategories.filter(sub => sub.id !== subcategoryId) }
        : cat
    ));
    setDeleteConfirm(null);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Edit Categories" size="lg">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Category List */}
          {localCategories.map(category => (
            <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Category Header */}
              <div 
                className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="font-medium">{category.name}</span>
                  <span className="text-sm text-gray-500">
                    ({category.subcategories.length} items)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCategory(category);
                    }}
                    className="text-gray-500 hover:text-gray-700 p-1"
                    title="Edit category"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ type: 'category', id: category.id });
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Delete category"
                  >
                    🗑️
                  </button>
                  <span className="text-gray-400">
                    {expandedCategory === category.id ? '▼' : '▶'}
                  </span>
                </div>
              </div>
              
              {/* Subcategories (Expanded) */}
              {expandedCategory === category.id && (
                <div className="p-3 bg-white space-y-2">
                  {category.subcategories.map(sub => (
                    <div 
                      key={sub.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span>{sub.icon}</span>
                        <span>{sub.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingSubcategory({ sub, parentId: category.id })}
                          className="text-gray-500 hover:text-gray-700 p-1 text-sm"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'subcategory', id: sub.id, parentId: category.id })}
                          className="text-red-500 hover:text-red-700 p-1 text-sm"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Subcategory */}
                  {showAddSubcategory === category.id ? (
                    <div className="p-2 bg-blue-50 rounded space-y-2">
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder="Subcategory name"
                        className="w-full px-2 py-1 border rounded text-sm"
                        autoFocus
                      />
                      <div className="flex flex-wrap gap-1">
                        {EMOJI_OPTIONS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => setNewSubIcon(emoji)}
                            className={`p-1 rounded ${newSubIcon === emoji ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAddSubcategory(category.id)}>
                          Add
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setShowAddSubcategory(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddSubcategory(category.id)}
                      className="w-full p-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded border border-dashed border-gray-300"
                    >
                      + Add Subcategory
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {/* Add New Category */}
          {showAddCategory ? (
            <div className="p-4 bg-blue-50 rounded-lg space-y-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="w-full px-3 py-2 border rounded"
                autoFocus
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setNewCategoryColor(color.value)}
                      className={`w-8 h-8 rounded-full border-2 ${newCategoryColor === color.value ? 'border-gray-800' : 'border-transparent'}`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddCategory}>Add Category</Button>
                <Button variant="secondary" onClick={() => setShowAddCategory(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="w-full p-4 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-dashed border-gray-300"
            >
              + Add New Category
            </button>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </Modal>

      {/* Edit Category Modal */}
      {editingCategory && (
        <Modal 
          isOpen={!!editingCategory} 
          onClose={() => setEditingCategory(null)} 
          title="Edit Category"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setEditingCategory({ ...editingCategory, color: color.value })}
                    className={`w-8 h-8 rounded-full border-2 ${editingCategory.color === color.value ? 'border-gray-800' : 'border-transparent'}`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setEditingCategory(null)}>Cancel</Button>
              <Button onClick={() => handleUpdateCategory(editingCategory)}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Subcategory Modal */}
      {editingSubcategory && (
        <Modal 
          isOpen={!!editingSubcategory} 
          onClose={() => setEditingSubcategory(null)} 
          title="Edit Subcategory"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={editingSubcategory.sub.name}
                onChange={(e) => setEditingSubcategory({ 
                  ...editingSubcategory, 
                  sub: { ...editingSubcategory.sub, name: e.target.value } 
                })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <div className="flex flex-wrap gap-1">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setEditingSubcategory({
                      ...editingSubcategory,
                      sub: { ...editingSubcategory.sub, icon: emoji }
                    })}
                    className={`p-2 rounded ${editingSubcategory.sub.icon === emoji ? 'bg-blue-200' : 'hover:bg-gray-200'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setEditingSubcategory(null)}>Cancel</Button>
              <Button onClick={() => handleUpdateSubcategory(editingSubcategory.sub, editingSubcategory.parentId)}>
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.type === 'category') {
            handleDeleteCategory(deleteConfirm.id);
          } else if (deleteConfirm?.type === 'subcategory' && deleteConfirm.parentId) {
            handleDeleteSubcategory(deleteConfirm.id, deleteConfirm.parentId);
          }
        }}
        title={`Delete ${deleteConfirm?.type === 'category' ? 'Category' : 'Subcategory'}`}
        message={
          deleteConfirm?.type === 'category'
            ? 'Delete this category and all its subcategories? Items using these categories will keep their current category ID but may show as uncategorized.'
            : 'Delete this subcategory? Items using this subcategory will keep their current category ID but may show as uncategorized.'
        }
        confirmText="Delete"
        danger={true}
      />
    </>
  );
}
