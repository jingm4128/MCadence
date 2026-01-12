import { useState } from 'react';
import { Category, Subcategory } from '@/lib/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

interface CategorySelectorProps {
  value: string;
  onChange: (categoryId: string) => void;
  placeholder?: string;
  className?: string;
}

export function CategorySelector({ 
  value, 
  onChange, 
  placeholder = "Select category", 
  className = "" 
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Find selected subcategory
  const selectedSubcategory = DEFAULT_CATEGORIES.flatMap(cat => cat.subcategories)
    .find(sub => sub.id === value);
  
  // Find parent category of the selected subcategory
  const selectedCategory = DEFAULT_CATEGORIES.find(cat => 
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
            {DEFAULT_CATEGORIES.map((category) => (
              <div key={category.id} className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
export function getCategoryColor(categoryId: string): string {
  if (!categoryId) return '#3b82f6'; // Default blue
  
  const category = DEFAULT_CATEGORIES.find(cat => 
    cat.subcategories.some(sub => sub.id === categoryId)
  );
  
  return category?.color || '#3b82f6';
}

// Helper function to get category icon
export function getCategoryIcon(categoryId: string): string {
  if (!categoryId) return '📌';
  
  const subcategory = DEFAULT_CATEGORIES.flatMap(cat => cat.subcategories)
    .find(sub => sub.id === categoryId);
  
  return subcategory?.icon || '📌';
}

// Helper function to get category display name
export function getCategoryDisplayName(categoryId: string): string {
  if (!categoryId) return '';
  
  const subcategory = DEFAULT_CATEGORIES.flatMap(cat => cat.subcategories)
    .find(sub => sub.id === categoryId);
  
  if (!subcategory) return '';
  
  const category = DEFAULT_CATEGORIES.find(cat => 
    cat.subcategories.some(sub => sub.id === categoryId)
  );
  
  return category ? `${category.name} > ${subcategory.name}` : subcategory.name;
}