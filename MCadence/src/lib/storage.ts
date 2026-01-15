import { AppState, Category } from './types';
import { STORAGE_KEY, DEBOUNCE_MS, DEFAULT_CATEGORIES } from './constants';

// Separate storage key for categories (for independent export/import)
export const CATEGORIES_STORAGE_KEY = 'mcadence_categories_v1';

// Read state from localStorage
export function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { items: [], actions: [], categories: [] };
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate the parsed state
    if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.actions)) {
      console.warn('Invalid state structure in localStorage, initializing empty state');
      return { items: [], actions: [], categories: [] };
    }
    
    return {
      items: parsed.items || [],
      actions: parsed.actions || [],
      categories: parsed.categories || []
    };
  } catch (error) {
    console.error('Error loading state from localStorage:', error);
    return { items: [], actions: [], categories: [] };
  }
}

// Save state to localStorage with debouncing
let saveTimeout: NodeJS.Timeout | null = null;

export function saveState(state: AppState): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving state to localStorage:', error);
    }
  }, DEBOUNCE_MS);
}

// Force immediate save (bypass debounce)
export function saveStateImmediate(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving state to localStorage:', error);
  }
}

// Clear all data from localStorage (state, categories, and active tab)
export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CATEGORIES_STORAGE_KEY);
    localStorage.removeItem('mcadence_active_tab'); // Also clear active tab preference
  } catch (error) {
    console.error('Error clearing state from localStorage:', error);
  }
}

// Export state as JSON string (for CSV export)
export function exportState(): string {
  const state = loadState();
  return JSON.stringify(state, null, 2);
}

// Import state from JSON string (for CSV import)
export function importState(jsonString: string): AppState {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Validate the imported state
    if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.actions)) {
      throw new Error('Invalid state structure');
    }
    
    return {
      items: parsed.items || [],
      actions: parsed.actions || [],
      categories: parsed.categories || []
    };
  } catch (error) {
    console.error('Error importing state:', error);
    throw new Error('Invalid data format');
  }
}

// === Category-specific storage functions ===

// Load categories from storage (falls back to DEFAULT_CATEGORIES)
export function loadCategories(): Category[] {
  try {
    const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!stored) {
      // Check if categories exist in main state
      const mainState = loadState();
      if (mainState.categories && mainState.categories.length > 0) {
        return mainState.categories;
      }
      return DEFAULT_CATEGORIES;
    }
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid categories structure in localStorage, using defaults');
      return DEFAULT_CATEGORIES;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error loading categories from localStorage:', error);
    return DEFAULT_CATEGORIES;
  }
}

// Save categories to storage
export function saveCategories(categories: Category[]): void {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (error) {
    console.error('Error saving categories to localStorage:', error);
  }
}

// Export categories as JSON string
export function exportCategories(): string {
  const categories = loadCategories();
  return JSON.stringify(categories, null, 2);
}

// Import categories from JSON string
export function importCategories(jsonString: string): Category[] {
  try {
    const parsed = JSON.parse(jsonString);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid categories structure: expected array');
    }
    
    // Validate each category has required fields
    for (const cat of parsed) {
      if (!cat.id || !cat.name || !cat.color || !Array.isArray(cat.subcategories)) {
        throw new Error('Invalid category structure: missing required fields');
      }
      for (const sub of cat.subcategories) {
        if (!sub.id || !sub.name || !sub.parentId) {
          throw new Error('Invalid subcategory structure: missing required fields');
        }
      }
    }
    
    return parsed;
  } catch (error) {
    console.error('Error importing categories:', error);
    throw new Error('Invalid categories format');
  }
}

// Merge imported categories with existing ones
export function mergeCategories(
  existing: Category[],
  imported: Category[],
  mode: 'combine' | 'overwrite'
): Category[] {
  if (mode === 'overwrite') {
    return imported;
  }
  
  // Combine mode: merge categories by id
  const merged = [...existing];
  
  for (const importedCat of imported) {
    const existingIndex = merged.findIndex(c => c.id === importedCat.id);
    if (existingIndex >= 0) {
      // Merge subcategories
      const existingSubs = merged[existingIndex].subcategories || [];
      const importedSubs = importedCat.subcategories || [];
      const mergedSubs = [...existingSubs];
      
      for (const importedSub of importedSubs) {
        const subIndex = mergedSubs.findIndex(s => s.id === importedSub.id);
        if (subIndex >= 0) {
          mergedSubs[subIndex] = importedSub; // Replace existing
        } else {
          mergedSubs.push(importedSub); // Add new
        }
      }
      
      merged[existingIndex] = {
        ...importedCat,
        subcategories: mergedSubs
      };
    } else {
      merged.push(importedCat); // Add new category
    }
  }
  
  return merged;
}

// Reset categories to defaults
export function resetCategoriesToDefaults(): Category[] {
  saveCategories(DEFAULT_CATEGORIES);
  return DEFAULT_CATEGORIES;
}

// Get storage usage info
export function getStorageInfo(): { used: number; available: number; percentage: number } {
  try {
    const testKey = 'test_storage_size';
    const testValue = 'x'.repeat(1024); // 1KB test string
    
    // Test available storage (approximate)
    let available = 0;
    try {
      localStorage.setItem(testKey, testValue);
      localStorage.removeItem(testKey);
      available = 5 * 1024 * 1024; // Assume 5MB available
    } catch {
      available = 0;
    }
    
    // Calculate used storage
    const currentData = localStorage.getItem(STORAGE_KEY) || '';
    const used = new Blob([currentData]).size;
    
    return {
      used,
      available,
      percentage: available > 0 ? (used / available) * 100 : 0
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return { used: 0, available: 0, percentage: 0 };
  }
}
