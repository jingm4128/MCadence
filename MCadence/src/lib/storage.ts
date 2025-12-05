import { AppState } from './types';
import { STORAGE_KEY, DEBOUNCE_MS } from './constants';

// Read state from localStorage
export function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { items: [], actions: [] };
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate the parsed state
    if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.actions)) {
      console.warn('Invalid state structure in localStorage, initializing empty state');
      return { items: [], actions: [] };
    }
    
    return {
      items: parsed.items || [],
      actions: parsed.actions || []
    };
  } catch (error) {
    console.error('Error loading state from localStorage:', error);
    return { items: [], actions: [] };
  }
}

// Save state to localStorage with debouncing
let saveTimeout: number | null = null;

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

// Clear all data from localStorage
export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
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
      actions: parsed.actions || []
    };
  } catch (error) {
    console.error('Error importing state:', error);
    throw new Error('Invalid data format');
  }
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
