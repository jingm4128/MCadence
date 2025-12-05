'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AppState, Item, ChecklistItem, TimeProject, ActionLog, TabId, ChecklistItemForm, TimeProjectForm } from './types';
import { saveState, loadState } from './storage';
import { generateId } from '@/utils/uuid';
import { toISOStringLocal, getWeekStart, getWeekEnd, getNowInTimezone, needsWeekReset } from '@/utils/date';
import { DEFAULT_COLOR } from './constants';

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
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, ...action.payload.updates, updatedAt: toISOStringLocal() }
            : item
        ),
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
      const itemsWithStoppedTimer = state.items.map((item: Item) => {
        if ('currentSessionStart' in item && item.currentSessionStart) {
          return { ...item, currentSessionStart: null, updatedAt: toISOStringLocal() } as TimeProject;
        }
        return item;
      });

      // Start new timer
      return {
        ...state,
        items: itemsWithStoppedTimer.map((item: Item) => {
          if (item.id === action.payload && 'currentSessionStart' in item) {
            return { ...item, currentSessionStart: toISOStringLocal(), updatedAt: toISOStringLocal() } as TimeProject;
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
            } as TimeProject;
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
            } as TimeProject;
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
} | null>(null);

// Provider component
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appStateReducer, { items: [], actions: [] });

  // Load state from localStorage on mount
  useEffect(() => {
    const loadedState = loadState();
    dispatch({ type: 'LOAD_STATE', payload: loadedState });
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (state.items.length > 0 || state.actions.length > 0) {
      saveState(state);
    }
  }, [state]);

  // Check for weekly period reset
  useEffect(() => {
    const timeProjects = state.items.filter(item => 'periodEnd' in item) as TimeProject[];
    const needsReset = timeProjects.some(project => needsWeekReset(project.periodEnd));
    
    if (needsReset) {
      dispatch({ type: 'RESET_WEEKLY_PERIODS' });
    }
  }, [state.items]);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
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

  const { state, dispatch } = context;

  // Action creators
  const logAction = (action: Omit<ActionLog, 'id' | 'timestamp'>) => {
    const actionLog: ActionLog = {
      ...action,
      id: generateId(),
      timestamp: toISOStringLocal(),
    };
    dispatch({ type: 'LOG_ACTION', payload: actionLog });
  };

  const addChecklistItem = (tab: 'dayToDay' | 'hitMyGoal', form: ChecklistItemForm) => {
    const now = toISOStringLocal();
    const newItem: ChecklistItem = {
      id: generateId(),
      tab,
      title: form.title,
      category: form.category,
      color: form.color || DEFAULT_COLOR.value,
      sortKey: Date.now(),
      status: 'active',
      isDone: false,
      createdAt: now,
      updatedAt: now,
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });
    logAction({
      itemId: newItem.id,
      tab,
      type: 'create',
    });
  };

  const addTimeProject = (form: TimeProjectForm) => {
    const now = getNowInTimezone();
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);
    const isoNow = toISOStringLocal();

    const newItem: TimeProject = {
      id: generateId(),
      tab: 'spendMyTime',
      title: form.title,
      category: form.category,
      color: form.color || DEFAULT_COLOR.value,
      sortKey: Date.now(),
      status: 'active',
      frequency: 'weekly',
      requiredMinutes: form.requiredHours * 60 + form.requiredMinutes,
      completedMinutes: 0,
      currentSessionStart: null,
      periodStart: toISOStringLocal(weekStart),
      periodEnd: toISOStringLocal(weekEnd),
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });
    logAction({
      itemId: newItem.id,
      tab: 'spendMyTime',
      type: 'create',
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

  const getActiveTimerProject = () => {
    return state.items.find(item => 
      'currentSessionStart' in item && item.currentSessionStart !== null
    ) as TimeProject | undefined;
  };

  return {
    state,
    dispatch,
    // Action creators
    addChecklistItem,
    addTimeProject,
    updateItem,
    deleteItem,
    archiveItem,
    toggleChecklistItem,
    startTimer,
    stopTimer,
    getItemsByTab,
    getActiveTimerProject,
    logAction,
  };
}

export type AppStateContextType = ReturnType<typeof useAppState>;

// Type guards
export function isChecklistItem(item: Item): item is ChecklistItem {
  return item.tab === 'dayToDay' || item.tab === 'hitMyGoal';
}

export function isTimeProject(item: Item): item is TimeProject {
  return item.tab === 'spendMyTime';
}
