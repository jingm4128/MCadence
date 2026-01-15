'use client';

import { useState } from 'react';
import { Category, Subcategory } from '@/lib/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { useAppState } from '@/lib/state';

interface CategorySelectorProps {
  value: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  className?: string;
  categories?: Category[]; // Optional: if not provided, will use state categories
}

// Get categories from storage for helper functions (called outside component context)
let cachedCategories: Category[] | null = null;

function getCategoriesFromStorage(): Category[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  
  try {
    // Use the storage module directly to avoid circular dependencies
    const stored = localStorage.getItem('mcadence_categories_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedCategories = parsed;
        return parsed;
      }
    }
    
    // Fallback to main state categories
    const mainState = localStorage.getItem('mcadence_state_v1');
    if (mainState) {
      const parsed = JSON.parse(mainState);
      if (parsed.categories && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        cachedCategories = parsed.categories;
        return parsed.categories;
      }
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
  
  return DEFAULT_CATEGORIES;
}

export function CategorySelector({
  value,
  onChange,
  placeholder = "Select category",
  className = "",
  categories: propCategories
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Try to get categories from state, fall back to prop, then defaults
  let stateCategories: Category[] | undefined;
  try {
    const { state } = useAppState();
    stateCategories = state?.categories;
  } catch {
    // useAppState might fail if not in provider context
  }
  
  const categories = propCategories
    || (stateCategories && stateCategories.length > 0 ? stateCategories : null)
    || DEFAULT_CATEGORIES;
  
  // Update cache for helper functions
  cachedCategories = categories;
  
  // Find selected subcategory
  const selectedSubcategory = categories.flatMap(cat => cat.subcategories)
    .find(sub => sub.id === value);
  
  // Find parent category of the selected subcategory
  const selectedCategory = categories.find(cat =>
    cat.subcategories.some(sub => sub.id === value)
  );

  const handleSelect = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-left flex items-center justify-between form-input"
      >
        <span className="flex items-center gap-2">
          {selectedSubcategory && (
            <span>{selectedSubcategory.icon}</span>
          )}
          <span className={selectedSubcategory ? 'text-gray-900' : 'text-gray-500'}>
            {selectedSubcategory
              ? `${selectedCategory?.name} > ${selectedSubcategory.name}`
              : placeholder
            }
          </span>
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto page-transition">
          <div className="p-2">
            {categories.map((category) => (
              <div key={category.id} className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </div>
                {category.subcategories.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    type="button"
                    onClick={() => handleSelect(subcategory.id)}
                    className={`w-full text-left px-4 py-2 rounded-md flex items-center gap-2 transition-colors btn-press ${
                      value === subcategory.id
                        ? 'bg-primary-100 text-primary-900'
                        : 'hover:bg-gray-100 text-gray-900'
                    }`}
                  >
                    <span>{subcategory.icon}</span>
                    <span>{subcategory.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get color by category ID
export function getCategoryColor(categoryId: string, providedCategories?: Category[]): string {
  if (!categoryId) return '#3b82f6'; // Default blue
  
  const categories = providedCategories || cachedCategories || getCategoriesFromStorage();
  
  const category = categories.find(cat =>
    cat.subcategories.some(sub => sub.id === categoryId)
  );
  
  return category?.color || '#3b82f6';
}

// Helper function to get category icon
export function getCategoryIcon(categoryId: string, providedCategories?: Category[]): string {
  if (!categoryId) return '📌';
  
  const categories = providedCategories || cachedCategories || getCategoriesFromStorage();
  
  const subcategory = categories.flatMap(cat => cat.subcategories)
    .find(sub => sub.id === categoryId);
  
  return subcategory?.icon || '📌';
}

// Helper function to get category display name
export function getCategoryDisplayName(categoryId: string, providedCategories?: Category[]): string {
  if (!categoryId) return '';
  
  const categories = providedCategories || cachedCategories || getCategoriesFromStorage();
  
  const subcategory = categories.flatMap(cat => cat.subcategories)
    .find(sub => sub.id === categoryId);
  
  if (!subcategory) return '';
  
  const category = categories.find(cat =>
    cat.subcategories.some(sub => sub.id === categoryId)
  );
  
  return category ? `${category.name} > ${subcategory.name}` : subcategory.name;
}

// Helper function to get parent category ID from subcategory ID
export function getParentCategoryId(subcategoryId: string, providedCategories?: Category[]): string | null {
  if (!subcategoryId) return null;
  
  const categories = providedCategories || cachedCategories || getCategoriesFromStorage();
  
  const category = categories.find(cat =>
    cat.subcategories.some(sub => sub.id === subcategoryId)
  );
  
  return category?.id || null;
}

// Helper function to get all parent categories
export function getCategories(providedCategories?: Category[]): Category[] {
  return providedCategories || cachedCategories || getCategoriesFromStorage();
}