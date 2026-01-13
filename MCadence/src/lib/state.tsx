'use client';

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { AppState, Item, ChecklistItem, TimeItem, ActionLog, TabId, ChecklistItemForm, TimeItemForm, RecurrenceSettings, RecurrenceFormSettings } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_TIMEZONE } from './constants';
import { saveState, loadState } from './storage';
import { generateId } from '@/utils/uuid';
import { toISOStringLocal, getWeekStart, getWeekEnd, getNowInTimezone, needsWeekReset } from '@/utils/date';

// Action types for the reducer
type AppStateAction =
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<Item> } }
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
            return {
              ...item,
              isDone: !item.isDone,
              completedAt: !item.isDone ? now : null,
              status: !item.isDone ? 'done' : 'active',
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
            ? { ...item, status: 'archived' as const, archivedAt: toISOStringLocal(), updatedAt: toISOStringLocal() }
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

  // Helper to convert form recurrence to full RecurrenceSettings
  const convertRecurrenceFormToSettings = (formRecurrence: RecurrenceFormSettings | undefined): RecurrenceSettings | undefined => {
    if (!formRecurrence || !formRecurrence.enabled) {
      return undefined;
    }
    
    const now = toISOStringLocal();
    return {
      frequency: formRecurrence.frequency,
      totalOccurrences: formRecurrence.totalOccurrences,
      completedOccurrences: 0,
      timezone: formRecurrence.timezone || DEFAULT_TIMEZONE,
      startDate: now,
      nextDue: now, // First occurrence is due now
    };
  };

  const addChecklistItem = (tab: 'dayToDay' | 'hitMyGoal', form: ChecklistItemForm) => {
    const now = toISOStringLocal();
    const recurrence = convertRecurrenceFormToSettings(form.recurrence);
    
    const newItem: ChecklistItem = {
      id: generateId(),
      tab,
      title: form.title,
      categoryId: form.categoryId,
      sortKey: Date.now(),
      status: 'active',
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
      payload: recurrence ? { recurrence } : undefined,
    });
  };

  const addTimeItem = (form: TimeItemForm) => {
    const now = getNowInTimezone();
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);
    const isoNow = toISOStringLocal();
    const recurrence = convertRecurrenceFormToSettings(form.recurrence);

    const newItem: TimeItem = {
      id: generateId(),
      tab: 'spendMyTime',
      title: form.title,
      categoryId: form.categoryId,
      sortKey: Date.now(),
      status: 'active',
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
      payload: recurrence ? { recurrence } : undefined,
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
      dispatch({ type: 'TOGGLE_CHECKLIST_ITEM', payload: id });
      logAction({
        itemId: id,
        tab: item.tab,
        type: 'complete',
        payload: { isDone: !item.isDone },
      });
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
      item.tab === tab && (includeArchived || item.status !== 'archived')
    ).sort((a, b) => {
      // Sort by status first, then by sortKey
      const statusOrder = { active: 0, done: 1, archived: 2 };
      const aStatus = statusOrder[a.status];
      const bStatus = statusOrder[b.status];
      
      if (aStatus !== bStatus) {
        return aStatus - bStatus;
      }
      
      return a.sortKey - b.sortKey;
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
