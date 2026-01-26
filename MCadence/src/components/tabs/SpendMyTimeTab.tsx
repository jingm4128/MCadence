'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppState } from '@/lib/state';
import { TimeItemForm, TimeItem, isTimeProject, RecurrenceFormSettings, RecurrenceSettings, SwipeAction } from '@/lib/types';
import { DEFAULT_CATEGORY_ID, WEEKLY_PROGRESS_ALERT_THRESHOLD, DEFAULT_TIMEZONE } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, RecurrenceDeleteDialog, NotesEditorModal } from '@/components/ui/Modal';
import { CategorySelector, getCategoryColor, getCategoryIcon, getParentCategoryId, getCategories } from '@/components/ui/CategorySelector';
import { RecurrenceSelector, getRecurrenceDisplayText, getSavedRecurrenceDisplayText } from '@/components/ui/RecurrenceSelector';
import { TabHeader } from '@/components/ui/TabHeader';
import { SwipeableItem } from '@/components/ui/SwipeableItem';
import { loadSettings, loadSettings as getSettings } from '@/lib/storage';
import { formatMinutes, getPeriodProgress, getNowInTimezone, needsWeekReset, getUrgencyStatus, getUrgencyStatusWithWork, getUrgencyClasses, formatDueDateDisplay, getCurrentPeriodKey, formatTitleWithPeriod, getPeriodDueDate, UrgencyStatus } from '@/utils/date';

// Edit item form state (for long press editing)
interface EditItemState {
  projectId: string;
  title: string;
  categoryId: string;
  hours: number;
  minutes: number;
}

// Edit recurrence state
interface EditRecurrenceState {
  projectId: string;
  recurrence: RecurrenceFormSettings | undefined;
  hasExistingRecurrence: boolean;
}

// Edit notes state
interface EditNotesState {
  itemId: string;
  notes: string;
  itemTitle: string;
}

export function SpendMyTimeTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editItemState, setEditItemState] = useState<EditItemState | null>(null);
  const [editRecurrenceState, setEditRecurrenceState] = useState<EditRecurrenceState | null>(null);
  const [editNotesState, setEditNotesState] = useState<EditNotesState | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0); // Real-time elapsed minutes for active timer
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState<TimeItemForm>({
    title: '',
    categoryId: DEFAULT_CATEGORY_ID,
    requiredHours: 1,
    requiredMinutes: 0,
    dueDate: undefined,
    recurrence: undefined,
  });

  // Helper to convert date input value to ISO string (end of day)
  const dateInputToISO = (dateStr: string): string => {
    const date = new Date(dateStr + 'T23:59:59');
    return date.toISOString();
  };

  // Helper to convert ISO string to date input value
  const isoToDateInput = (isoStr: string | null | undefined): string => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toISOString().split('T')[0];
  };

  const {
    getItemsByTab,
    addTimeItem,
    startTimer,
    stopTimer,
    archiveItem,
    unarchiveItem,
    deleteItem,
    deleteRecurringSeries,
    getActiveTimerItem,
    updateItem,
    archiveAllCompletedInTab,
    state
  } = useAppState();

  // Get parent categories for filter dropdown - ensure we use getCategories() which loads from storage
  const categories = (state?.categories && state.categories.length > 0) ? state.categories : getCategories();
  const allItems = getItemsByTab('spendMyTime').filter(isTimeProject);
  const allArchivedItems = getItemsByTab('spendMyTime', true).filter(item => item.isArchived && isTimeProject(item));
  const activeTimerProject = getActiveTimerItem();

  // Filter items by category
  const items = categoryFilter === 'all'
    ? allItems
    : allItems.filter(item => getParentCategoryId(item.categoryId) === categoryFilter);
  const archivedItems = categoryFilter === 'all'
    ? allArchivedItems
    : allArchivedItems.filter(item => getParentCategoryId(item.categoryId) === categoryFilter);

  // Update elapsed time every second when a timer is running
  useEffect(() => {
    if (!activeTimerProject?.currentSessionStart) {
      setElapsedMinutes(0);
      return;
    }

    const updateElapsed = () => {
      const now = new Date();
      const sessionStart = new Date(activeTimerProject.currentSessionStart!);
      const elapsed = Math.floor((now.getTime() - sessionStart.getTime()) / (1000 * 60));
      setElapsedMinutes(elapsed);
    };

    // Update immediately
    updateElapsed();

    // Then update every second for smooth timer display
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeTimerProject?.currentSessionStart]);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleAddProject = () => {
    if (formData.title.trim() && (formData.requiredHours > 0 || formData.requiredMinutes > 0)) {
      addTimeItem(formData);
      setFormData({
        title: '',
        categoryId: DEFAULT_CATEGORY_ID,
        requiredHours: 1,
        requiredMinutes: 0,
        dueDate: undefined,
        recurrence: undefined
      });
      setShowAddModal(false);
    }
  };

  const handleArchive = (id: string) => {
    archiveItem(id);
    setToastMessage('Archived, go to archived to recover');
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  // Get swipe handlers based on settings
  const getSwipeHandlers = useCallback((id: string, isActive: boolean) => {
    const settings = loadSettings();
    const swipeConfig = settings.swipeConfig.spendMyTime;
    
    const executeAction = (action: SwipeAction) => {
      if (action === 'delete') {
        handleDelete(id);
      } else {
        handleArchive(id);
      }
    };
    
    return {
      onSwipeLeft: () => executeAction(swipeConfig.left),
      onSwipeRight: () => executeAction(swipeConfig.right),
      leftLabel: swipeConfig.left === 'delete' ? 'Delete' : 'Archive',
      rightLabel: swipeConfig.right === 'delete' ? 'Delete' : 'Archive',
      leftColor: swipeConfig.left === 'delete' ? 'bg-red-500' : 'bg-blue-500',
      rightColor: swipeConfig.right === 'delete' ? 'bg-red-500' : 'bg-blue-500',
      disabled: isActive,
    };
  }, []);

  // Get the item to be deleted
  const itemToDeleteData = useMemo(() => {
    if (!itemToDelete) return null;
    const allItemsIncludingArchived = getItemsByTab('spendMyTime', true);
    return allItemsIncludingArchived.find(i => i.id === itemToDelete) || null;
  }, [itemToDelete, getItemsByTab]);

  // Check if the item being deleted is a recurring item
  const isRecurringDelete = useMemo(() => {
    return itemToDeleteData?.baseTitle && itemToDeleteData?.recurrence;
  }, [itemToDeleteData]);

  // Get count of items in the recurring series
  const recurringSeriesCount = useMemo(() => {
    if (!itemToDeleteData?.baseTitle) return 0;
    return state.items.filter(i =>
      i.baseTitle === itemToDeleteData.baseTitle &&
      i.tab === 'spendMyTime' &&
      !i.isDeleted
    ).length;
  }, [itemToDeleteData, state.items]);

  const confirmDeleteOne = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  const confirmDeleteAll = () => {
    if (itemToDelete) {
      deleteRecurringSeries(itemToDelete);
      setItemToDelete(null);
    }
  };

  // Edit item functions (long press)
  const handleEditItem = (project: TimeItem) => {
    setEditItemState({
      projectId: project.id,
      title: project.title,
      categoryId: project.categoryId,
      hours: Math.floor(project.completedMinutes / 60),
      minutes: project.completedMinutes % 60,
    });
  };

  const confirmEditItem = () => {
    if (editItemState) {
      const newCompletedMinutes = editItemState.hours * 60 + editItemState.minutes;
      updateItem(editItemState.projectId, {
        title: editItemState.title.trim(),
        categoryId: editItemState.categoryId,
        completedMinutes: newCompletedMinutes
      });
      setEditItemState(null);
    }
  };

  // Edit recurrence functions
  const handleEditRecurrence = (project: TimeItem) => {
    const existingRecurrence = project.recurrence;
    setEditRecurrenceState({
      projectId: project.id,
      recurrence: existingRecurrence ? {
        enabled: true,
        frequency: existingRecurrence.frequency,
        interval: existingRecurrence.interval || 1,
        totalOccurrences: existingRecurrence.totalOccurrences,
        timezone: existingRecurrence.timezone,
      } : undefined,
      hasExistingRecurrence: !!existingRecurrence,
    });
  };

  const confirmEditRecurrence = () => {
    if (editRecurrenceState) {
      const { projectId, recurrence } = editRecurrenceState;
      
      // Find the item to check for existing recurrence
      const allProjectsList = getItemsByTab('spendMyTime', true);
      const project = allProjectsList.find(p => p.id === projectId);
      if (!project || !isTimeProject(project)) {
        setEditRecurrenceState(null);
        return;
      }
      
      const existingRecurrence = project.recurrence;
      
      if (!recurrence || !recurrence.enabled) {
        // Remove recurrence
        updateItem(projectId, { recurrence: undefined });
      } else {
        // Check if we're converting a non-recurring item to recurring
        const isConvertingToRecurring = !existingRecurrence;
        
        // Get settings for week start day
        const settings = getSettings();
        const weekStartDay = settings.weekStartDay;
        
        // Calculate periodKey and nextDue for recurring items
        const periodKey = getCurrentPeriodKey(recurrence.frequency, undefined, weekStartDay);
        const nextDue = getPeriodDueDate(periodKey);
        
        // Build new recurrence settings
        const newRecurrence: RecurrenceSettings = {
          frequency: recurrence.frequency,
          interval: recurrence.interval || 1,
          totalOccurrences: recurrence.totalOccurrences,
          completedOccurrences: existingRecurrence?.completedOccurrences || 0,
          timezone: recurrence.timezone || DEFAULT_TIMEZONE,
          startDate: existingRecurrence?.startDate || new Date().toISOString(),
          nextDue: nextDue,
        };
        
        if (isConvertingToRecurring) {
          // Converting non-recurring to recurring:
          // - Set baseTitle to preserve original title
          // - Update title with period suffix
          // - Set periodKey for the current period
          // - Clear any explicit dueDate (recurrence.nextDue will be used)
          const baseTitle = project.baseTitle || project.title;
          const newTitle = formatTitleWithPeriod(baseTitle, periodKey);
          
          updateItem(projectId, {
            recurrence: newRecurrence,
            baseTitle: baseTitle,
            title: newTitle,
            periodKey: periodKey,
            dueDate: undefined, // Clear explicit due date when using recurrence
          });
        } else {
          // Just updating existing recurrence settings
          updateItem(projectId, { recurrence: newRecurrence });
        }
      }
      
      setEditRecurrenceState(null);
    }
  };

  // Edit notes functions
  const handleEditNotes = (project: TimeItem) => {
    setEditNotesState({
      itemId: project.id,
      notes: project.notes || '',
      itemTitle: project.title,
    });
  };

  const confirmEditNotes = (notes: string) => {
    if (editNotesState) {
      updateItem(editNotesState.itemId, { notes: notes || undefined });
      setEditNotesState(null);
    }
  };

  const handleProjectClick = (projectId: string) => {
    const project = items.find(p => p.id === projectId);
    if (project) {
      if (activeTimerProject?.id === projectId) {
        stopTimer(projectId);
      } else {
        startTimer(projectId);
      }
    }
  };

  const getProjectStatus = (project: TimeItem) => {
    if (project.isArchived) return 'archived';
    
    const now = getNowInTimezone();
    const periodStart = new Date(project.periodStart);
    const periodEnd = new Date(project.periodEnd);
    const projectProgress = project.completedMinutes / project.requiredMinutes;
    const remainingMinutes = Math.max(0, project.requiredMinutes - project.completedMinutes);
    
    // Check if week has rolled over
    if (needsWeekReset(project.periodEnd)) {
      return 'overdue';
    }
    
    // Check if project is overdue
    if (now > periodEnd && projectProgress < 1) {
      return 'overdue';
    }
    
    // For recurring items, use work-based urgency (time left < 3X of work remaining)
    if (project.recurrence?.nextDue) {
      const recurrenceUrgency = getUrgencyStatusWithWork(
        project.recurrence.nextDue,
        remainingMinutes,
        projectProgress >= 1
      );
      if (recurrenceUrgency === 'overdue' || recurrenceUrgency === 'urgent') {
        return recurrenceUrgency;
      }
      if (recurrenceUrgency === 'warning') {
        return 'warning';
      }
    }
    
    // Check if project should show warning (80% of period elapsed)
    const periodProgress = getPeriodProgress(periodStart, periodEnd, now);
    
    if (periodProgress >= WEEKLY_PROGRESS_ALERT_THRESHOLD && projectProgress < 1) {
      return 'warning';
    }
    
    return 'normal';
  };

  const formatTimeRemaining = (project: TimeItem) => {
    if (project.isArchived) return '';
    
    const remaining = project.requiredMinutes - project.completedMinutes;
    if (remaining <= 0) return 'Complete!';
    
    return `${formatMinutes(Math.abs(remaining))} remaining`;
  };

  const getElapsedTimeDisplay = () => {
    if (elapsedMinutes === 0) return '0m';
    return formatMinutes(elapsedMinutes);
  };

  // Check if there are completed items to archive (progress >= 1)
  const completedCount = allItems.filter(project => {
    const progress = project.completedMinutes / project.requiredMinutes;
    return progress >= 1;
  }).length;

  const handleArchiveAllCompleted = () => {
    const count = archiveAllCompletedInTab('spendMyTime');
    if (count > 0) {
      setToastMessage(`Archived ${count} completed project${count > 1 ? 's' : ''}`);
    }
  };

  return (
    <div>
      <TabHeader
        archivedCount={allArchivedItems.length}
        showArchive={showArchive}
        onToggleArchive={() => setShowArchive(!showArchive)}
        completedCount={completedCount}
        onArchiveAllCompleted={handleArchiveAllCompleted}
        onAdd={() => setShowAddModal(true)}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      {/* Projects List - No separate active timer display, integrated into cards */}
      {showArchive ? (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 mb-2">Archived projects</p>
          {archivedItems.map((project) => {
            const timeProject = isTimeProject(project) ? project : null;
            const progress = timeProject ? Math.min(1, timeProject.completedMinutes / timeProject.requiredMinutes) : 0;
            const isComplete = progress >= 1;
            return (
              <div
                key={project.id}
                className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 opacity-70"
                style={{ borderLeftColor: getCategoryColor(project.categoryId), borderLeftWidth: "4px" }}
              >
                <div className="flex items-center gap-2">
                  {/* Completion status indicator */}
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isComplete
                      ? 'bg-green-100 border-green-500 text-green-600'
                      : 'bg-gray-100 border-gray-400'
                  }`}>
                    {isComplete && (
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate ${isComplete ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                      {project.categoryId && <span className="mr-1">{getCategoryIcon(project.categoryId)}</span>}
                      {project.title}
                    </h3>
                    {/* Show time progress */}
                    {timeProject && (
                      <span className="text-xs text-gray-400">
                        {formatMinutes(timeProject.completedMinutes)} / {formatMinutes(timeProject.requiredMinutes)}
                        {isComplete && ' ✓'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => unarchiveItem(project.id)}
                      className="text-primary-600 hover:text-primary-800 p-0.5"
                      title="Restore"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-red-400 hover:text-red-600 p-0.5"
                      title="Delete"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {archivedItems.length === 0 && (
            <p className="text-center text-gray-500 py-8">No archived projects</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((project) => {
            const status = getProjectStatus(project);
            const isActive = activeTimerProject?.id === project.id;
            const progress = Math.min(1, project.completedMinutes / project.requiredMinutes);
            
            // Check urgency - prioritize dueDate, then recurrence nextDue
            const effectiveDueDate = (project.dueDate ?? project.recurrence?.nextDue) ?? undefined;  // Convert null to undefined
            const hasRecurrence = !!project.recurrence;
            const hasDueDate = !!effectiveDueDate;
            const remainingMinutes = Math.max(0, project.requiredMinutes - project.completedMinutes);
            const itemUrgency: UrgencyStatus = hasDueDate
              ? getUrgencyStatusWithWork(effectiveDueDate, remainingMinutes, progress >= 1)
              : 'normal';
            const urgencyClasses = getUrgencyClasses(itemUrgency);
            const dueDateDisplay = formatDueDateDisplay(effectiveDueDate, progress >= 1);
            
            // Calculate progress percentage for background
            const progressPercent = Math.min(100, progress * 100);
            const activeProgressPercent = isActive ? Math.min(100, (elapsedMinutes / project.requiredMinutes) * 100) : 0;
            const categoryColor = getCategoryColor(project.categoryId);
            
            const swipeHandlers = getSwipeHandlers(project.id, isActive);
            return (
              <SwipeableItem
                key={project.id}
                onSwipeLeft={swipeHandlers.onSwipeLeft}
                onSwipeRight={swipeHandlers.onSwipeRight}
                onLongPress={() => handleEditItem(project)}
                leftLabel={swipeHandlers.leftLabel}
                rightLabel={swipeHandlers.rightLabel}
                leftColor={swipeHandlers.leftColor}
                rightColor={swipeHandlers.rightColor}
                disabled={swipeHandlers.disabled}
              >
                <div
                  className={`relative overflow-hidden rounded-lg border shadow-sm cursor-pointer transition-all category-transition hover-lift bg-white ${
                    isActive ? 'ring-2 ring-primary-500 border-primary-500' : 'hover:shadow-md'
                  } ${
                    status === 'overdue' || status === 'urgent'
                      ? 'border-red-200'
                      : status === 'warning'
                      ? 'border-yellow-200'
                      : 'border-gray-200'
                  }`}
                  style={{ borderLeftColor: categoryColor, borderLeftWidth: '4px' }}
                  onClick={() => handleProjectClick(project.id)}
                >
                  {/* Progress bar as full background using category color */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Completed progress background - category color with transparency */}
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-300"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: categoryColor,
                        opacity: 0.15
                      }}
                    />
                    {/* Active session progress (pulsing) - slightly more opaque */}
                    {isActive && activeProgressPercent > 0 && (
                      <div
                        className="absolute inset-y-0 animate-pulse"
                        style={{
                          left: `${progressPercent}%`,
                          width: `${activeProgressPercent}%`,
                          backgroundColor: categoryColor,
                          opacity: 0.25
                        }}
                      />
                    )}
                  </div>
                  
                  {/* Content overlay */}
                  <div className="relative px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className={`text-sm font-medium truncate ${
                            status === 'overdue' || status === 'urgent' ? 'text-red-600' :
                            isActive ? 'text-primary-900' : 'text-gray-900'
                          }`}>
                            {project.categoryId && <span className="mr-1">{getCategoryIcon(project.categoryId)}</span>}
                            {project.title}
                          </h3>
                          {/* Due date display - always shown at end of item */}
                          {progress < 1 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${hasDueDate ? urgencyClasses.badge : 'bg-gray-100 text-gray-500'}`}>
                              {dueDateDisplay}
                            </span>
                          )}
                        </div>
                        {/* Time display - inline */}
                        <div className="flex items-center gap-2 text-xs mt-0.5">
                          <span className={`font-medium ${
                            progress >= 1 ? 'text-green-600' :
                            status === 'overdue' || status === 'urgent' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {formatMinutes(project.completedMinutes + (isActive ? elapsedMinutes : 0))}
                            {' / '}{formatMinutes(project.requiredMinutes)}
                            {progress >= 1 && ' ✓'}
                          </span>
                          {isActive && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                stopTimer(project.id);
                              }}
                              className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors font-medium"
                            >
                              ⏹ Stop
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditNotes(project);
                          }}
                          className={`p-0.5 ${project.notes ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
                          title={project.notes ? "Edit Notes" : "Add Notes"}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditRecurrence(project);
                          }}
                          className="text-gray-400 hover:text-gray-600 p-0.5"
                          title="Edit Recurrence"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </SwipeableItem>
            );
          })}
          {items.length === 0 && (
            <div className="text-center py-12 empty-state">
              <div className="empty-state-icon">⏱️</div>
              <p className="text-gray-500 mb-4">No time projects yet</p>
              <Button onClick={() => setShowAddModal(true)} className="btn-press">
                Add your first project
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Project Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Time Project">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && formData.title.trim() && (formData.requiredHours > 0 || formData.requiredMinutes > 0)) {
                  e.preventDefault();
                  handleAddProject();
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter project title"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <CategorySelector
              value={formData.categoryId}
              onChange={(categoryId) => setFormData({ ...formData, categoryId })}
              placeholder="Select category"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Time *
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  value={formData.requiredHours}
                  onChange={(e) => setFormData({ ...formData, requiredHours: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Hours"
                />
              </div>
              <div className="flex items-center px-2">
                <span>h</span>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={formData.requiredMinutes}
                  onChange={(e) => setFormData({ ...formData, requiredMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Minutes"
                />
              </div>
              <div className="flex items-center px-2">
                <span>m</span>
              </div>
            </div>
          </div>
          
          {/* Due Date - only show when no recurrence is set */}
          {!formData.recurrence?.enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={isoToDateInput(formData.dueDate)}
                  onChange={(e) => setFormData({
                    ...formData,
                    dueDate: e.target.value ? dateInputToISO(e.target.value) : undefined
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {formData.dueDate && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, dueDate: undefined })}
                    className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    title="Clear due date"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Set a due date to track urgency</p>
            </div>
          )}

          {/* Recurrence Settings */}
          <div>
            <RecurrenceSelector
              value={formData.recurrence}
              onChange={(recurrence) => setFormData({ ...formData, recurrence, dueDate: recurrence?.enabled ? undefined : formData.dueDate })}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddProject} className="btn-press">
              Add Project
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation - Show different dialogs for recurring vs non-recurring items */}
      {isRecurringDelete ? (
        <RecurrenceDeleteDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onDeleteOne={confirmDeleteOne}
          onDeleteAll={confirmDeleteAll}
          title="Delete Recurring Project"
          itemName={itemToDeleteData?.baseTitle}
          seriesCount={recurringSeriesCount}
        />
      ) : (
        <ConfirmDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={confirmDeleteOne}
          title="Delete Project"
          message="Delete this project and all its history? This cannot be undone."
          confirmText="Delete"
          danger={true}
        />
      )}

      {/* Edit Item Modal (Long Press) */}
      <Modal
        isOpen={!!editItemState}
        onClose={() => setEditItemState(null)}
        title="Edit Project"
      >
        {editItemState && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Edit the project name, category, and adjust the completed time.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Title
              </label>
              <input
                type="text"
                value={editItemState.title}
                onChange={(e) => setEditItemState({
                  ...editItemState,
                  title: e.target.value
                })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editItemState.title.trim()) {
                    e.preventDefault();
                    confirmEditItem();
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter project title"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <CategorySelector
                value={editItemState.categoryId}
                onChange={(categoryId) => setEditItemState({
                  ...editItemState,
                  categoryId
                })}
                placeholder="Select category"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Completed Time
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    value={editItemState.hours}
                    onChange={(e) => setEditItemState({
                      ...editItemState,
                      hours: Math.max(0, parseInt(e.target.value) || 0)
                    })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Hours"
                  />
                </div>
                <div className="flex items-center px-2">
                  <span>h</span>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={editItemState.minutes}
                    onChange={(e) => setEditItemState({
                      ...editItemState,
                      minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
                    })}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Minutes"
                  />
                </div>
                <div className="flex items-center px-2">
                  <span>m</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setEditItemState(null)}
              >
                Cancel
              </Button>
              <Button onClick={confirmEditItem}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Recurrence Modal */}
      <Modal
        isOpen={!!editRecurrenceState}
        onClose={() => setEditRecurrenceState(null)}
        title="Edit Recurrence"
      >
        {editRecurrenceState && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {editRecurrenceState.hasExistingRecurrence
                ? 'Modify or remove the recurrence settings for this project.'
                : 'Add recurrence settings to make this a recurring project.'}
            </p>
            <RecurrenceSelector
              value={editRecurrenceState.recurrence}
              onChange={(recurrence) => setEditRecurrenceState({
                ...editRecurrenceState,
                recurrence
              })}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setEditRecurrenceState(null)}
              >
                Cancel
              </Button>
              <Button onClick={confirmEditRecurrence}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Notes Editor Modal */}
      <NotesEditorModal
        isOpen={!!editNotesState}
        onClose={() => setEditNotesState(null)}
        onSave={confirmEditNotes}
        notes={editNotesState?.notes || ''}
        itemTitle={editNotesState?.itemTitle}
      />

      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
