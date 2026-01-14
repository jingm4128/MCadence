'use client';

import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { AppState, Item, ChecklistItem, TimeItem, ActionLog, TabId, ChecklistItemForm, TimeItemForm, RecurrenceSettings, RecurrenceFormSettings } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_TIMEZONE, ITEM_STATUS } from './constants';
import { saveState, loadState } from './storage';
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

// Action types for the reducer
type AppStateAction =
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'ADD_ITEMS'; payload: Item[] }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<Item> } }
  | { type: 'UPDATE_ITEMS'; payload: { id: string; updates: Partial<Item> }[] }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'TOGGLE_CHECKLIST_ITEM'; payload: string }
  | { type: 'ARCHIVE_ITEM'; payload: string }
  | { type: 'START_TIMER'; payload: string }
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
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
        actions: state.actions.filter(log => log.itemId !== action.payload),
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

    case 'START_TIMER':
      // Stop any existing timer first
      const itemsWithStoppedTimer = state.items.map((item: Item): Item => {
        if ('currentSessionStart' in item && item.currentSessionStart) {
          return { ...item, currentSessionStart: null, updatedAt: toISOStringLocal() };
        }
        return item;
      });

      // Start new timer
      return {
        ...state,
        items: itemsWithStoppedTimer.map((item: Item): Item => {
          if (item.id === action.payload && 'currentSessionStart' in item) {
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
            
            return {
              ...item,
              currentSessionStart: null,
              completedMinutes: item.completedMinutes + elapsedMinutes,
              updatedAt: toISOStringLocal(),
            } as TimeItem;
          }
          return item;
        }),
      };

    case 'RESET_WEEKLY_PERIODS':
      const now = getNowInTimezone();
      const newWeekStart = getWeekStart(now);
      const newWeekEnd = getWeekEnd(now);

      return {
        ...state,
        items: state.items.map(item => {
          if ('currentSessionStart' in item) {
            return {
              ...item,
              currentSessionStart: null,
              completedMinutes: 0,
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

  // Load state from localStorage on mount
  useEffect(() => {
    const loadedState = loadState();
    dispatch({ type: 'LOAD_STATE', payload: loadedState });
    setIsHydrated(true);
  }, []);

  // Save state to localStorage whenever it changes (only after hydration)
  useEffect(() => {
    if (isHydrated && (state.items.length > 0 || state.actions.length > 0)) {
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
    const recurringItems = state.items.filter(item =>
      item.periodKey &&
      item.recurrence &&
      !item.isArchived
    );
    
    if (recurringItems.length === 0) return;
    
    const newItems: Item[] = [];
    const updates: { id: string; updates: Partial<Item> }[] = [];
    
    for (const item of recurringItems) {
      const { periodKey, recurrence, baseTitle } = item;
      if (!periodKey || !recurrence || !baseTitle) continue;
      
      // Check if the period has passed
      if (!isPeriodPassed(periodKey, recurrence.frequency)) continue;
      
      // Get the current period key
      const currentPeriodKey = getCurrentPeriodKey(recurrence.frequency);
      
      // Check if we already have an item for the current period (by baseTitle + currentPeriodKey)
      const existingCurrentPeriodItem = state.items.find(i =>
        i.baseTitle === baseTitle &&
        i.periodKey === currentPeriodKey &&
        !i.isArchived
      );
      
      if (existingCurrentPeriodItem) continue; // Already have current period item
      
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
        const weekStart = getWeekStart(getNowInTimezone());
        const weekEnd = getWeekEnd(getNowInTimezone());
        
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
      {children}
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
    // Use periodKey to determine nextDue, or calculate based on current period
    const nextDue = periodKey
      ? getPeriodDueDate(periodKey)
      : calculateNextDue(now, formRecurrence.frequency, tz);
    
    return {
      frequency: formRecurrence.frequency,
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
      ? getCurrentPeriodKey(form.recurrence!.frequency)
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
      ...(recurrence && { recurrence }),
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });
    logAction({
      itemId: newItem.id,
      tab,
      type: 'create',
      payload: recurrence ? { recurrence, periodKey } : undefined,
    });
  };

  const addTimeItem = (form: TimeItemForm) => {
    const now = getNowInTimezone();
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);
    const isoNow = toISOStringLocal();
    const hasRecurrence = form.recurrence?.enabled;
    
    // For recurring items, add period key and format title with date
    const periodKey = hasRecurrence
      ? getCurrentPeriodKey(form.recurrence!.frequency)
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
      ...(recurrence && { recurrence }),
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });
    logAction({
      itemId: newItem.id,
      tab: 'spendMyTime',
      type: 'create',
      payload: recurrence ? { recurrence, periodKey } : undefined,
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
      dispatch({ type: 'START_TIMER', payload: id });
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
      
      dispatch({ type: 'STOP_TIMER', payload: id });
      logAction({
        itemId: id,
        tab: 'spendMyTime',
        type: 'timer_stop',
        payload: { durationMinutes: elapsedMinutes },
      });
    }
  };

  const getItemsByTab = (tab: TabId, includeArchived = false) => {
    return state.items.filter(item =>
      item.tab === tab && (includeArchived || !item.isArchived)
    ).sort((a, b) => {
      // Sort by title (name)
      return a.title.localeCompare(b.title);
    });
  };

  const getActiveTimerItem = () => {
    return state.items.find(item => 
      'currentSessionStart' in item && item.currentSessionStart !== null
    ) as TimeItem | undefined;
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
    archiveItem,
    toggleChecklistItem,
    startTimer,
    stopTimer,
    getItemsByTab,
    getActiveTimerItem,
    logAction,
  };
}

export type AppStateContextType = ReturnType<typeof useAppState>;

// Type guards are in types.ts - re-export them here for convenience
export { isChecklistItem, isTimeProject } from './types';
