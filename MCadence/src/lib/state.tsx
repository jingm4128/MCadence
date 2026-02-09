'use client';

import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { AppState, Item, ChecklistItem, TimeItem, ActionLog, TabId, ChecklistItemForm, TimeItemForm, RecurrenceSettings, RecurrenceFormSettings, WeekStartDay } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_TIMEZONE, ITEM_STATUS } from './constants';
import { saveState, loadState, loadStateAsync, loadSettings } from './storage';
import { generateId } from '@/utils/uuid';
import {
  toISOStringLocal,
  getWeekStart,
  getWeekEnd,
  getNowInTimezone,
  needsWeekReset,
  advanceRecurrence,
  calculateNextDue,
  getCurrentPeriodKey,
  getNextPeriodKey,
  formatTitleWithPeriod,
  getPeriodDueDate,
  isPeriodPassed
} from '@/utils/date';

// Helper to get week start day from settings (defaults to Monday)
function getWeekStartDaySetting(): WeekStartDay {
  if (typeof window === 'undefined') return 1; // SSR default
  const settings = loadSettings();
  return settings.weekStartDay;
}

// Action types for the reducer
type AppStateAction =
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'ADD_ITEMS'; payload: Item[] }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<Item> } }
  | { type: 'UPDATE_ITEMS'; payload: { id: string; updates: Partial<Item> }[] }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'DELETE_RECURRING_SERIES'; payload: { baseTitle: string; tab: TabId } }
  | { type: 'TOGGLE_CHECKLIST_ITEM'; payload: string }
  | { type: 'ARCHIVE_ITEM'; payload: string }
  | { type: 'UNARCHIVE_ITEM'; payload: string }
  | { type: 'START_TIMER'; payload: { id: string; allowConcurrent: boolean } }
  | { type: 'STOP_TIMER'; payload: string }
  | { type: 'RESET_WEEKLY_PERIODS'; }
  | { type: 'LOG_ACTION'; payload: ActionLog };

// Reducer function
function appStateReducer(state: AppState, action: AppStateAction): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return action.payload;

    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, action.payload],
      };

    case 'ADD_ITEMS':
      return {
        ...state,
        items: [...state.items, ...action.payload],
      };

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item => {
          if (item.id === action.payload.id) {
            // Create a properly typed update by merging with type safety
            const updatedItem = { ...item, ...action.payload.updates, updatedAt: toISOStringLocal() };
            
            // Ensure the updated item maintains correct type structure
            if (item.tab === 'spendMyTime') {
              return updatedItem as TimeItem;
            } else {
              return updatedItem as ChecklistItem;
            }
          }
          return item;
        }),
      };

    case 'UPDATE_ITEMS':
      return {
        ...state,
        items: state.items.map(item => {
          const update = action.payload.find(u => u.id === item.id);
          if (update) {
            const updatedItem = { ...item, ...update.updates, updatedAt: toISOStringLocal() };
            if (item.tab === 'spendMyTime') {
              return updatedItem as TimeItem;
            } else {
              return updatedItem as ChecklistItem;
            }
          }
          return item;
        }),
      };

    case 'DELETE_ITEM':
      // Soft delete: mark as deleted instead of removing from array
      // This keeps records and action logs for data history
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload
            ? { ...item, isDeleted: true, deletedAt: toISOStringLocal(), updatedAt: toISOStringLocal() }
            : item
        ),
        // Keep action logs - don't filter them
      };

    case 'DELETE_RECURRING_SERIES':
      // Soft delete ALL items with the same baseTitle in the same tab
      // This stops the entire recurring series from generating new occurrences
      const { baseTitle: targetBaseTitle, tab: targetTab } = action.payload;
      return {
        ...state,
        items: state.items.map(item =>
          item.baseTitle === targetBaseTitle && item.tab === targetTab && !item.isDeleted
            ? { ...item, isDeleted: true, deletedAt: toISOStringLocal(), updatedAt: toISOStringLocal() }
            : item
        ),
      };

    case 'TOGGLE_CHECKLIST_ITEM':
      return {
        ...state,
        items: state.items.map(item => {
          if (item.id === action.payload && 'isDone' in item) {
            const now = toISOStringLocal();
            const checklistItem = item as ChecklistItem;
            
            // For items with periodKey (new date-tagged system), simply toggle done status
            if (checklistItem.periodKey && checklistItem.recurrence) {
              const newIsDone = !checklistItem.isDone;
              const newCompletedOccurrences = newIsDone
                ? checklistItem.recurrence.completedOccurrences + 1
                : Math.max(0, checklistItem.recurrence.completedOccurrences - 1);
              
              return {
                ...checklistItem,
                isDone: newIsDone,
                completedAt: newIsDone ? now : null,
                status: newIsDone ? ITEM_STATUS.DONE : ITEM_STATUS.ACTIVE,
                updatedAt: now,
                recurrence: {
                  ...checklistItem.recurrence,
                  completedOccurrences: newCompletedOccurrences,
                },
              } as ChecklistItem;
            }
            
            // Legacy recurring items without periodKey - old behavior (reset on complete)
            if (checklistItem.recurrence && !checklistItem.isDone) {
              const advancedRecurrence = advanceRecurrence(checklistItem.recurrence);
              
              if (advancedRecurrence === null) {
                // Occurrence limit reached - archive the item
                return {
                  ...checklistItem,
                  isDone: true,
                  completedAt: now,
                  status: ITEM_STATUS.DONE,
                  isArchived: true,
                  archivedAt: now,
                  updatedAt: now,
                  recurrence: {
                    ...checklistItem.recurrence,
                    completedOccurrences: checklistItem.recurrence.completedOccurrences + 1,
                  },
                } as ChecklistItem;
              }
              
              // Auto-reset for next occurrence - keep active, update recurrence
              return {
                ...checklistItem,
                isDone: false,
                completedAt: null,
                status: ITEM_STATUS.ACTIVE,
                updatedAt: now,
                recurrence: advancedRecurrence,
              } as ChecklistItem;
            }
            
            // Non-recurring item - standard toggle behavior
            return {
              ...item,
              isDone: !item.isDone,
              completedAt: !item.isDone ? now : null,
              status: !item.isDone ? ITEM_STATUS.DONE : ITEM_STATUS.ACTIVE,
              updatedAt: now,
            } as ChecklistItem;
          }
          return item;
        }),
      };

    case 'ARCHIVE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload
            ? { ...item, isArchived: true, archivedAt: toISOStringLocal(), updatedAt: toISOStringLocal() }
            : item
        ),
      };

    case 'UNARCHIVE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload
            ? { ...item, isArchived: false, archivedAt: undefined, updatedAt: toISOStringLocal() }
            : item
        ),
      };

    case 'START_TIMER':
      const { id: timerId, allowConcurrent } = action.payload;
      
      // If not allowing concurrent timers, stop any existing timer first
      let itemsForTimerStart = state.items;
      if (!allowConcurrent) {
        itemsForTimerStart = state.items.map((item: Item): Item => {
          if ('currentSessionStart' in item && item.currentSessionStart) {
            return { ...item, currentSessionStart: null, updatedAt: toISOStringLocal() };
          }
          return item;
        });
      }

      // Start new timer
      return {
        ...state,
        items: itemsForTimerStart.map((item: Item): Item => {
          if (item.id === timerId && 'currentSessionStart' in item) {
            return { ...item, currentSessionStart: toISOStringLocal(), updatedAt: toISOStringLocal() };
          }
          return item;
        }),
      };

    case 'STOP_TIMER':
      return {
        ...state,
        items: state.items.map(item => {
          if (item.id === action.payload && 'currentSessionStart' in item && item.currentSessionStart) {
            const now = new Date();
            const sessionStart = new Date(item.currentSessionStart);
            const elapsedMinutes = Math.floor((now.getTime() - sessionStart.getTime()) / (1000 * 60));
            const newCompletedMinutes = item.completedMinutes + elapsedMinutes;
            const isComplete = newCompletedMinutes >= item.requiredMinutes;
            
            return {
              ...item,
              currentSessionStart: null,
              completedMinutes: newCompletedMinutes,
              status: isComplete ? ITEM_STATUS.DONE : item.status,
              updatedAt: toISOStringLocal(),
            } as TimeItem;
          }
          return item;
        }),
      };

    case 'RESET_WEEKLY_PERIODS':
      const now = getNowInTimezone();
      const weekStartDay = getWeekStartDaySetting();
      const newWeekStart = getWeekStart(now, weekStartDay);
      const newWeekEnd = getWeekEnd(now, weekStartDay);

      return {
        ...state,
        items: state.items.map(item => {
          // Skip archived items entirely - they are historical records
          if (item.isArchived) {
            return item;
          }
          if ('currentSessionStart' in item) {
            // Only update period dates, preserve completedMinutes
            // This prevents data loss when importing backups with old period dates
            // New occurrences for recurring items are created separately with completedMinutes: 0
            return {
              ...item,
              currentSessionStart: null,
              // completedMinutes is intentionally NOT reset - preserves imported/historical progress
              periodStart: toISOStringLocal(newWeekStart),
              periodEnd: toISOStringLocal(newWeekEnd),
              updatedAt: toISOStringLocal(),
            } as TimeItem;
          }
          return item;
        }),
      };

    case 'LOG_ACTION':
      return {
        ...state,
        actions: [...state.actions, action.payload],
      };

    default:
      return state;
  }
}

// Create context
const AppStateContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppStateAction>;
  isHydrated: boolean;
} | null>(null);

// Provider component
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appStateReducer, { items: [], actions: [], categories: DEFAULT_CATEGORIES });
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load state from localStorage on mount (async to prevent blocking on large data)
  useEffect(() => {
    let cancelled = false;
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Use async loading to prevent blocking the main thread
        const loadedState = await loadStateAsync();
        
        if (!cancelled) {
          dispatch({ type: 'LOAD_STATE', payload: loadedState });
          setIsHydrated(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to load state:', error);
        if (!cancelled) {
          // Fallback to empty state on error
          dispatch({ type: 'LOAD_STATE', payload: { items: [], actions: [], categories: DEFAULT_CATEGORIES } });
          setIsHydrated(true);
          setIsLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      cancelled = true;
    };
  }, []);

  // Save state to localStorage whenever it changes (only after hydration)
  // Note: We always save after hydration, even if items/actions appear empty,
  // because soft-deleted items still exist in the array
  useEffect(() => {
    if (isHydrated) {
      saveState(state);
    }
  }, [state, isHydrated]);

  // Check for weekly period reset
  useEffect(() => {
    if (!isHydrated) return;
    
    const timeItems = state.items.filter((item): item is TimeItem => 'periodEnd' in item);
    const needsReset = timeItems.some(item => needsWeekReset(item.periodEnd));
    
    if (needsReset) {
      dispatch({ type: 'RESET_WEEKLY_PERIODS' });
    }
  }, [state.items, isHydrated]);

  // Auto-create new period items when period passes (for date-tagged recurring items)
  useEffect(() => {
    if (!isHydrated) return;
    
    // Find all recurring items with periodKey
    // Note: We include archived items because we still want to create new period items
    // for recurring tasks even if the previous period's item was archived
    // But we exclude deleted items - they should not generate new occurrences
    const recurringItems = state.items.filter(item =>
      item.periodKey &&
      item.recurrence &&
      !item.isDeleted
    );
    
    if (recurringItems.length === 0) return;
    
    const newItems: Item[] = [];
    const updates: { id: string; updates: Partial<Item> }[] = [];
    
    // Track which baseTitle + currentPeriodKey combinations we've already processed
    // This prevents creating duplicate items when multiple old period items exist
    const processedRecurrences = new Set<string>();
    
    for (const item of recurringItems) {
      const { periodKey, recurrence, baseTitle } = item;
      if (!periodKey || !recurrence || !baseTitle) continue;
      
      // Check if the period has passed
      if (!isPeriodPassed(periodKey, recurrence.frequency)) continue;
      
      // Get the current period key
      const currentPeriodKey = getCurrentPeriodKey(recurrence.frequency, undefined, getWeekStartDaySetting());
      
      // Create a tracking key for this baseTitle + current period combination
      const trackingKey = `${baseTitle}::${currentPeriodKey}`;
      
      // Skip if we've already processed this recurring task for the current period
      if (processedRecurrences.has(trackingKey)) continue;
      
      // Check if we already have an item for the current period (by baseTitle + currentPeriodKey)
      // Note: We check ALL items (including archived) to prevent duplicates when an item
      // for the current period was manually archived before it expired
      const existingCurrentPeriodItem = state.items.find(i =>
        i.baseTitle === baseTitle &&
        i.periodKey === currentPeriodKey
      );
      
      if (existingCurrentPeriodItem) {
        // Mark as processed so we don't check again for other old period items
        processedRecurrences.add(trackingKey);
        continue;
      }
      
      // Mark as processed before creating new item to prevent duplicates
      processedRecurrences.add(trackingKey);
      
      // Check recurrence limit
      if (recurrence.totalOccurrences !== null &&
          recurrence.completedOccurrences >= recurrence.totalOccurrences) {
        continue; // Limit reached, don't create new item
      }
      
      // Mark old item as missed if not completed
      if (item.status === ITEM_STATUS.ACTIVE) {
        updates.push({
          id: item.id,
          updates: { status: ITEM_STATUS.MISSED },
        });
      }
      
      // Create new item for current period
      const now = toISOStringLocal();
      const newPeriodKey = currentPeriodKey;
      const newTitle = formatTitleWithPeriod(baseTitle, newPeriodKey);
      const newNextDue = getPeriodDueDate(newPeriodKey);
      
      if ('isDone' in item) {
        // ChecklistItem
        const checklistItem = item as ChecklistItem;
        const newChecklistItem: ChecklistItem = {
          id: generateId(),
          tab: checklistItem.tab,
          title: newTitle,
          baseTitle,
          periodKey: newPeriodKey,
          categoryId: checklistItem.categoryId,
          sortKey: Date.now(),
          status: ITEM_STATUS.ACTIVE,
          isArchived: false,
          isDone: false,
          createdAt: now,
          updatedAt: now,
          recurrence: {
            ...recurrence,
            nextDue: newNextDue,
          },
        };
        newItems.push(newChecklistItem);
      } else if ('completedMinutes' in item) {
        // TimeItem
        const timeItem = item as TimeItem;
        const weekStartDaySetting = getWeekStartDaySetting();
        const weekStart = getWeekStart(getNowInTimezone(), weekStartDaySetting);
        const weekEnd = getWeekEnd(getNowInTimezone(), weekStartDaySetting);
        
        const newTimeItem: TimeItem = {
          id: generateId(),
          tab: 'spendMyTime',
          title: newTitle,
          baseTitle,
          periodKey: newPeriodKey,
          categoryId: timeItem.categoryId,
          sortKey: Date.now(),
          status: ITEM_STATUS.ACTIVE,
          isArchived: false,
          requiredMinutes: timeItem.requiredMinutes,
          completedMinutes: 0,
          currentSessionStart: null,
          periodStart: toISOStringLocal(weekStart),
          periodEnd: toISOStringLocal(weekEnd),
          createdAt: now,
          updatedAt: now,
          recurrence: {
            ...recurrence,
            nextDue: newNextDue,
          },
        };
        newItems.push(newTimeItem);
      }
    }
    
    // Dispatch updates for old items (mark as missed)
    if (updates.length > 0) {
      dispatch({ type: 'UPDATE_ITEMS', payload: updates });
    }
    
    // Dispatch new items
    if (newItems.length > 0) {
      dispatch({ type: 'ADD_ITEMS', payload: newItems });
    }
  }, [state.items, isHydrated]);

  return (
    <AppStateContext.Provider value={{ state, dispatch, isHydrated }}>
      {isLoading ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your data...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a moment for large datasets</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AppStateContext.Provider>
  );
}

// Hook to use the app state
export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }

  const { state, dispatch, isHydrated } = context;

  // Action creators
  const logAction = (action: Omit<ActionLog, 'id' | 'timestamp'>) => {
    const actionLog: ActionLog = {
      ...action,
      id: generateId(),
      timestamp: toISOStringLocal(),
    };
    dispatch({ type: 'LOG_ACTION', payload: actionLog });
  };

  // Helper to convert form recurrence to full RecurrenceSettings with period key
  const convertRecurrenceFormToSettings = (
    formRecurrence: RecurrenceFormSettings | undefined,
    periodKey?: string
  ): RecurrenceSettings | undefined => {
    if (!formRecurrence || !formRecurrence.enabled) {
      return undefined;
    }
    
    const now = toISOStringLocal();
    const tz = formRecurrence.timezone || DEFAULT_TIMEZONE;
    const interval = formRecurrence.interval || 1;
    // Use periodKey to determine nextDue, or calculate based on current period
    const nextDue = periodKey
      ? getPeriodDueDate(periodKey)
      : calculateNextDue(now, formRecurrence.frequency, tz, interval);
    
    return {
      frequency: formRecurrence.frequency,
      interval,
      totalOccurrences: formRecurrence.totalOccurrences,
      completedOccurrences: 0,
      timezone: tz,
      startDate: now,
      nextDue,
    };
  };

  const addChecklistItem = (tab: 'dayToDay' | 'hitMyGoal', form: ChecklistItemForm) => {
    const now = toISOStringLocal();
    const hasRecurrence = form.recurrence?.enabled;
    
    // For recurring items, add period key and format title with date
    const periodKey = hasRecurrence
      ? getCurrentPeriodKey(form.recurrence!.frequency, undefined, getWeekStartDaySetting())
      : undefined;
    
    const recurrence = convertRecurrenceFormToSettings(form.recurrence, periodKey);
    
    // Title includes period suffix for recurring items
    const displayTitle = hasRecurrence && periodKey
      ? formatTitleWithPeriod(form.title, periodKey)
      : form.title;
    
    const newItem: ChecklistItem = {
      id: generateId(),
      tab,
      title: displayTitle,
      baseTitle: hasRecurrence ? form.title : undefined,
      periodKey,
      categoryId: form.categoryId,
      sortKey: Date.now(),
      status: ITEM_STATUS.ACTIVE,
      isArchived: false,
      isDone: false,
      createdAt: now,
      updatedAt: now,
      // Add dueDate if provided (for non-recurring items)
      ...(form.dueDate !== undefined && { dueDate: form.dueDate }),
      ...(recurrence && { recurrence }),
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });
    logAction({
      itemId: newItem.id,
      tab,
      type: 'create',
      payload: recurrence ? { recurrence, periodKey } : (form.dueDate ? { dueDate: form.dueDate } : undefined),
    });
  };

  const addTimeItem = (form: TimeItemForm) => {
    const now = getNowInTimezone();
    const weekStartDaySetting = getWeekStartDaySetting();
    const weekStart = getWeekStart(now, weekStartDaySetting);
    const weekEnd = getWeekEnd(now, weekStartDaySetting);
    const isoNow = toISOStringLocal();
    const hasRecurrence = form.recurrence?.enabled;
    
    // For recurring items, add period key and format title with date
    const periodKey = hasRecurrence
      ? getCurrentPeriodKey(form.recurrence!.frequency, undefined, weekStartDaySetting)
      : undefined;
    
    const recurrence = convertRecurrenceFormToSettings(form.recurrence, periodKey);
    
    // Title includes period suffix for recurring items
    const displayTitle = hasRecurrence && periodKey
      ? formatTitleWithPeriod(form.title, periodKey)
      : form.title;

    const newItem: TimeItem = {
      id: generateId(),
      tab: 'spendMyTime',
      title: displayTitle,
      baseTitle: hasRecurrence ? form.title : undefined,
      periodKey,
      categoryId: form.categoryId,
      sortKey: Date.now(),
      status: ITEM_STATUS.ACTIVE,
      isArchived: false,
      requiredMinutes: form.requiredHours * 60 + form.requiredMinutes,
      completedMinutes: 0,
      currentSessionStart: null,
      periodStart: toISOStringLocal(weekStart),
      periodEnd: toISOStringLocal(weekEnd),
      createdAt: isoNow,
      updatedAt: isoNow,
      // Add dueDate if provided (for non-recurring items)
      ...(form.dueDate !== undefined && { dueDate: form.dueDate }),
      ...(recurrence && { recurrence }),
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });
    logAction({
      itemId: newItem.id,
      tab: 'spendMyTime',
      type: 'create',
      payload: recurrence ? { recurrence, periodKey } : (form.dueDate ? { dueDate: form.dueDate } : undefined),
    });
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    const item = state.items.find(i => i.id === id);
    if (item) {
      dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } });
      logAction({
        itemId: id,
        tab: item.tab,
        type: 'update',
        payload: updates,
      });
    }
  };

  const deleteItem = (id: string) => {
    const item = state.items.find(i => i.id === id);
    if (item) {
      logAction({
        itemId: id,
        tab: item.tab,
        type: 'delete',
      });
      dispatch({ type: 'DELETE_ITEM', payload: id });
    }
  };

  // Delete all items in a recurring series (all items with the same baseTitle)
  const deleteRecurringSeries = (id: string) => {
    const item = state.items.find(i => i.id === id);
    if (item && item.baseTitle) {
      // Find all items in the series to log them
      const seriesItems = state.items.filter(i =>
        i.baseTitle === item.baseTitle &&
        i.tab === item.tab &&
        !i.isDeleted
      );
      
      // Log deletion for each item in the series
      seriesItems.forEach(seriesItem => {
        logAction({
          itemId: seriesItem.id,
          tab: seriesItem.tab,
          type: 'delete',
          payload: { reason: 'recurring_series_deleted', baseTitle: item.baseTitle },
        });
      });
      
      dispatch({
        type: 'DELETE_RECURRING_SERIES',
        payload: { baseTitle: item.baseTitle, tab: item.tab }
      });
      
      return seriesItems.length;
    }
    return 0;
  };

  const archiveItem = (id: string) => {
    const item = state.items.find(i => i.id === id);
    if (item) {
      dispatch({ type: 'ARCHIVE_ITEM', payload: id });
      logAction({
        itemId: id,
        tab: item.tab,
        type: 'archive',
      });
    }
  };

  const unarchiveItem = (id: string) => {
    const item = state.items.find(i => i.id === id);
    if (item) {
      dispatch({ type: 'UNARCHIVE_ITEM', payload: id });
      logAction({
        itemId: id,
        tab: item.tab,
        type: 'unarchive',
      });
    }
  };

  const toggleChecklistItem = (id: string) => {
    const item = state.items.find(i => i.id === id);
    if (item && 'isDone' in item) {
      const checklistItem = item as ChecklistItem;
      const hasRecurrence = !!checklistItem.recurrence;
      const wasNotDone = !checklistItem.isDone;
      
      dispatch({ type: 'TOGGLE_CHECKLIST_ITEM', payload: id });
      
      if (hasRecurrence && wasNotDone) {
        // Log recurrence completion
        const rec = checklistItem.recurrence!;
        const newOccurrenceCount = rec.completedOccurrences + 1;
        const reachedLimit = rec.totalOccurrences !== null && newOccurrenceCount >= rec.totalOccurrences;
        
        logAction({
          itemId: id,
          tab: item.tab,
          type: 'complete',
          payload: {
            isDone: true,
            recurrence: {
              completedOccurrence: newOccurrenceCount,
              totalOccurrences: rec.totalOccurrences,
              reachedLimit,
              autoReset: !reachedLimit,
            }
          },
        });
        
        if (reachedLimit) {
          logAction({
            itemId: id,
            tab: item.tab,
            type: 'archive',
            payload: { reason: 'recurrence_limit_reached' },
          });
        }
      } else {
        // Standard toggle log
        logAction({
          itemId: id,
          tab: item.tab,
          type: 'complete',
          payload: { isDone: !checklistItem.isDone },
        });
      }
    }
  };

  const startTimer = (id: string) => {
    const item = state.items.find(i => i.id === id);
    if (item && 'currentSessionStart' in item) {
      // Check settings for concurrent timer support
      const settings = loadSettings();
      const allowConcurrent = settings.allowConcurrentTimers;
      
      dispatch({ type: 'START_TIMER', payload: { id, allowConcurrent } });
      logAction({
        itemId: id,
        tab: 'spendMyTime',
        type: 'timer_start',
      });
    }
  };

  const stopTimer = (id: string) => {
    const item = state.items.find(i => i.id === id);
    if (item && 'currentSessionStart' in item && item.currentSessionStart) {
      const now = new Date();
      const sessionStart = new Date(item.currentSessionStart);
      const elapsedMinutes = Math.floor((now.getTime() - sessionStart.getTime()) / (1000 * 60));
      const newCompletedMinutes = item.completedMinutes + elapsedMinutes;
      const wasNotComplete = item.completedMinutes < item.requiredMinutes;
      const isNowComplete = newCompletedMinutes >= item.requiredMinutes;
      
      dispatch({ type: 'STOP_TIMER', payload: id });
      
      // Log timer stop
      logAction({
        itemId: id,
        tab: 'spendMyTime',
        type: 'timer_stop',
        payload: { durationMinutes: elapsedMinutes },
      });
      
      // Log completion when item reaches its goal
      if (wasNotComplete && isNowComplete) {
        logAction({
          itemId: id,
          tab: 'spendMyTime',
          type: 'complete',
          payload: {
            completedMinutes: newCompletedMinutes,
            requiredMinutes: item.requiredMinutes,
            recurrence: item.recurrence ? {
              completedOccurrence: item.recurrence.completedOccurrences + 1,
              totalOccurrences: item.recurrence.totalOccurrences,
            } : undefined,
          },
        });
      }
    }
  };

  // Helper to check if an item is completed
  const isItemCompleted = (item: Item): boolean => {
    // Check for checklist items (isDone)
    if ('isDone' in item && item.isDone) return true;
    
    // Check for time items (completedMinutes >= requiredMinutes)
    if ('completedMinutes' in item && 'requiredMinutes' in item) {
      return item.completedMinutes >= item.requiredMinutes;
    }
    
    // Check status
    if (item.status === ITEM_STATUS.DONE) return true;
    
    return false;
  };

  const getItemsByTab = (tab: TabId, includeArchived = false) => {
    return state.items.filter(item =>
      item.tab === tab &&
      !item.isDeleted && // Always exclude soft-deleted items
      (includeArchived || !item.isArchived)
    ).sort((a, b) => {
      // 1. Sort by status: finished/done items go to bottom
      const aIsDone = isItemCompleted(a);
      const bIsDone = isItemCompleted(b);
      if (aIsDone !== bIsDone) {
        return aIsDone ? 1 : -1; // Done items at bottom
      }
      
      // 2. Sort by due date (earlier due dates come first, no due date at bottom)
      // Use dueDate field first, fall back to recurrence.nextDue for recurring items
      const aDue = a.dueDate || a.recurrence?.nextDue;
      const bDue = b.dueDate || b.recurrence?.nextDue;
      
      // Items with no due date go to the bottom
      const aHasDue = !!aDue;
      const bHasDue = !!bDue;
      if (aHasDue !== bHasDue) {
        return aHasDue ? -1 : 1; // Items with due dates come first
      }
      
      // Both have due dates - sort by date (earlier first)
      if (aDue && bDue) {
        const dateDiff = new Date(aDue).getTime() - new Date(bDue).getTime();
        if (dateDiff !== 0) return dateDiff;
      }
      
      // 3. Sort by category and subcategory
      const aCategory = a.categoryId || '';
      const bCategory = b.categoryId || '';
      const categoryDiff = aCategory.localeCompare(bCategory);
      if (categoryDiff !== 0) return categoryDiff;
      
      // 4. Finally sort by title
      return a.title.localeCompare(b.title);
    });
  };

  const archiveAllCompletedInTab = (tab: TabId) => {
    const completedItems = state.items.filter(item => {
      if (item.tab !== tab || item.isArchived || item.isDeleted) return false;
      
      // Check for checklist items (isDone)
      if ('isDone' in item && item.isDone) return true;
      
      // Check for time items (completedMinutes >= requiredMinutes)
      if ('completedMinutes' in item && 'requiredMinutes' in item) {
        return item.completedMinutes >= item.requiredMinutes;
      }
      
      // Check status
      if (item.status === ITEM_STATUS.DONE) return true;
      
      return false;
    });
    
    completedItems.forEach(item => {
      dispatch({ type: 'ARCHIVE_ITEM', payload: item.id });
      logAction({
        itemId: item.id,
        tab: item.tab,
        type: 'archive',
        payload: { reason: 'batch_archive_completed' },
      });
    });
    
    return completedItems.length;
  };

  // Returns first active timer item (for backward compatibility)
  const getActiveTimerItem = () => {
    return state.items.find(item =>
      !item.isDeleted &&
      'currentSessionStart' in item && item.currentSessionStart !== null
    ) as TimeItem | undefined;
  };

  // Returns all active timer items (when concurrent timers are enabled)
  const getActiveTimerItems = () => {
    return state.items.filter(item =>
      !item.isDeleted &&
      'currentSessionStart' in item && item.currentSessionStart !== null
    ) as TimeItem[];
  };

  return {
    state,
    dispatch,
    isHydrated,
    // Action creators
    addChecklistItem,
    addTimeItem,
    updateItem,
    deleteItem,
    deleteRecurringSeries,
    archiveItem,
    unarchiveItem,
    toggleChecklistItem,
    startTimer,
    stopTimer,
    getItemsByTab,
    getActiveTimerItem,
    getActiveTimerItems,
    archiveAllCompletedInTab,
    logAction,
  };
}

export type AppStateContextType = ReturnType<typeof useAppState>;

// Type guards are in types.ts - re-export them here for convenience
export { isChecklistItem, isTimeProject } from './types';
