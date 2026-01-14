'use client';

import { useState, useEffect } from 'react';
import { useAppState } from '@/lib/state';
import { TimeItemForm, TimeItem, isTimeProject, RecurrenceFormSettings, RecurrenceSettings } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/Modal';
import { CategorySelector, getCategoryColor, getCategoryIcon, getCategoryDisplayName } from '@/components/ui/CategorySelector';
import { RecurrenceSelector, getRecurrenceDisplayText, getSavedRecurrenceDisplayText } from '@/components/ui/RecurrenceSelector';
import { WEEKLY_PROGRESS_ALERT_THRESHOLD } from '@/lib/constants';
import { formatMinutes, getPeriodProgress, getNowInTimezone, needsWeekReset, getUrgencyStatus, getUrgencyClasses, formatTimeUntilDue, UrgencyStatus } from '@/utils/date';

// Edit time form state
interface EditTimeState {
  projectId: string;
  hours: number;
  minutes: number;
}

// Edit recurrence state
interface EditRecurrenceState {
  projectId: string;
  recurrence: RecurrenceFormSettings | undefined;
  hasExistingRecurrence: boolean;
}

export function SpendMyTimeTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [itemToArchive, setItemToArchive] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editTimeState, setEditTimeState] = useState<EditTimeState | null>(null);
  const [editRecurrenceState, setEditRecurrenceState] = useState<EditRecurrenceState | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0); // Real-time elapsed minutes for active timer
  const [formData, setFormData] = useState<TimeItemForm>({
    title: '',
    categoryId: '',
    requiredHours: 1,
    requiredMinutes: 0,
    recurrence: undefined,
  });

  const {
    getItemsByTab,
    addTimeItem,
    startTimer,
    stopTimer,
    archiveItem,
    unarchiveItem,
    deleteItem,
    getActiveTimerItem,
    updateItem
  } = useAppState();

  const items = getItemsByTab('spendMyTime').filter(isTimeProject);
  const archivedItems = getItemsByTab('spendMyTime', true).filter(item => item.isArchived && isTimeProject(item));
  const activeTimerProject = getActiveTimerItem();

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

  const handleAddProject = () => {
    if (formData.title.trim() && (formData.requiredHours > 0 || formData.requiredMinutes > 0)) {
      addTimeItem(formData);
      setFormData({
        title: '',
        categoryId: '',
        requiredHours: 1,
        requiredMinutes: 0,
        recurrence: undefined
      });
      setShowAddModal(false);
    }
  };

  const handleArchive = (id: string) => {
    setItemToArchive(id);
  };

  const confirmArchive = () => {
    if (itemToArchive) {
      archiveItem(itemToArchive);
      setItemToArchive(null);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  // Edit time functions
  const handleEditTime = (project: TimeItem) => {
    setEditTimeState({
      projectId: project.id,
      hours: Math.floor(project.completedMinutes / 60),
      minutes: project.completedMinutes % 60,
    });
  };

  const confirmEditTime = () => {
    if (editTimeState) {
      const newCompletedMinutes = editTimeState.hours * 60 + editTimeState.minutes;
      updateItem(editTimeState.projectId, { completedMinutes: newCompletedMinutes });
      setEditTimeState(null);
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
        totalOccurrences: existingRecurrence.totalOccurrences,
        timezone: existingRecurrence.timezone,
      } : undefined,
      hasExistingRecurrence: !!existingRecurrence,
    });
  };

  const confirmEditRecurrence = () => {
    if (editRecurrenceState) {
      const { projectId, recurrence } = editRecurrenceState;
      
      if (!recurrence || !recurrence.enabled) {
        // Remove recurrence
        updateItem(projectId, { recurrence: undefined });
      } else {
        // Update recurrence - preserve existing completedOccurrences
        const project = items.find(p => p.id === projectId);
        const existingRecurrence = project?.recurrence;
        
        const newRecurrence: RecurrenceSettings = {
          frequency: recurrence.frequency,
          totalOccurrences: recurrence.totalOccurrences,
          completedOccurrences: existingRecurrence?.completedOccurrences || 0,
          timezone: recurrence.timezone,
          startDate: existingRecurrence?.startDate || new Date().toISOString(),
          nextDue: existingRecurrence?.nextDue || new Date().toISOString(),
        };
        
        updateItem(projectId, { recurrence: newRecurrence });
      }
      
      setEditRecurrenceState(null);
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
    
    // Check if week has rolled over
    if (needsWeekReset(project.periodEnd)) {
      return 'overdue';
    }
    
    // Check if project is overdue
    if (now > periodEnd && projectProgress < 1) {
      return 'overdue';
    }
    
    // For recurring items, also check recurrence urgency
    if (project.recurrence?.nextDue) {
      const recurrenceUrgency = getUrgencyStatus(project.recurrence.nextDue, projectProgress >= 1);
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

  return (
    <div>
      {/* Header with Add button - Title removed as requested */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {archivedItems.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setShowArchive(!showArchive)}
            >
              {showArchive ? 'Active' : `Archived (${archivedItems.length})`}
            </Button>
          )}
          <Button onClick={() => setShowAddModal(true)} className="font-bold text-lg">
            +
          </Button>
        </div>
      </div>

      {/* Projects List - No separate active timer display, integrated into cards */}
      {showArchive ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 mb-4">Archived projects</p>
          {archivedItems.map((project) => {
            const timeProject = isTimeProject(project) ? project : null;
            const progress = timeProject ? Math.min(1, timeProject.completedMinutes / timeProject.requiredMinutes) : 0;
            const isComplete = progress >= 1;
            return (
              <div
                key={project.id}
                className="bg-white p-4 rounded-lg border border-gray-200 opacity-70"
                style={{ borderLeftColor: getCategoryColor(project.categoryId), borderLeftWidth: "4px" }}
              >
                <div className="flex items-center gap-3">
                  {/* Completion status indicator */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isComplete
                      ? 'bg-green-100 border-green-500 text-green-600'
                      : 'bg-gray-100 border-gray-400'
                  }`}>
                    {isComplete && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-medium ${isComplete ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                      {project.title}
                    </h3>
                    {project.categoryId && (
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <span>{getCategoryIcon(project.categoryId)}</span>
                        {getCategoryDisplayName(project.categoryId)}
                      </span>
                    )}
                    {/* Show time progress */}
                    {timeProject && (
                      <span className="text-xs text-gray-400">
                        {formatMinutes(timeProject.completedMinutes)} / {formatMinutes(timeProject.requiredMinutes)}
                        {isComplete && ' ✓'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => unarchiveItem(project.id)}
                      className="text-primary-600 hover:text-primary-800 p-1"
                      title="Restore"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-red-400 hover:text-red-600 p-1"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="space-y-3">
          {items.map((project) => {
            const status = getProjectStatus(project);
            const isActive = activeTimerProject?.id === project.id;
            const progress = Math.min(1, project.completedMinutes / project.requiredMinutes);
            
            // Check recurrence urgency for additional visual indicators
            const hasRecurrence = !!project.recurrence;
            const recurrenceUrgency: UrgencyStatus = hasRecurrence
              ? getUrgencyStatus(project.recurrence?.nextDue, progress >= 1)
              : 'normal';
            const urgencyClasses = getUrgencyClasses(recurrenceUrgency);
            const timeUntilDue = hasRecurrence ? formatTimeUntilDue(project.recurrence?.nextDue) : '';
            
            // Calculate progress percentage for background
            const progressPercent = Math.min(100, progress * 100);
            const activeProgressPercent = isActive ? Math.min(100, (elapsedMinutes / project.requiredMinutes) * 100) : 0;
            const categoryColor = getCategoryColor(project.categoryId);
            
            return (
              <div
                key={project.id}
                className={`relative overflow-hidden rounded-lg border shadow-sm swipe-hint cursor-pointer transition-all category-transition hover-lift bg-white ${
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
                <div className="relative p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${
                          status === 'overdue' || status === 'urgent' ? 'text-red-600' :
                          isActive ? 'text-primary-900' : 'text-gray-900'
                        }`}>
                          {project.title}
                        </h3>
                        {/* Urgency badge for recurring items */}
                        {hasRecurrence && timeUntilDue && progress < 1 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${urgencyClasses.badge}`}>
                            {timeUntilDue}
                          </span>
                        )}
                      </div>
                      {project.categoryId && (
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <span>{getCategoryIcon(project.categoryId)}</span>
                          {getCategoryDisplayName(project.categoryId)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRecurrence(project);
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Edit Recurrence"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTime(project);
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Edit Time"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(project.id);
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Archive"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project.id);
                        }}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Delete"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Time display - simplified */}
                  <div className="flex justify-between items-center text-sm">
                    <span className={`font-medium ${
                      progress >= 1 ? 'text-green-600' :
                      status === 'overdue' || status === 'urgent' ? 'text-red-600' : 'text-gray-700'
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
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium"
                      >
                        ⏹ Stop
                      </button>
                    )}
                  </div>
                </div>
              </div>
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
              value={formData.categoryId}
              onChange={(categoryId) => setFormData({ ...formData, categoryId })}
              placeholder="Optional category"
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
          
          {/* Recurrence Settings */}
          <div>
            <RecurrenceSelector
              value={formData.recurrence}
              onChange={(recurrence) => setFormData({ ...formData, recurrence })}
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

      {/* Archive Confirmation */}
      <ConfirmDialog
        isOpen={!!itemToArchive}
        onClose={() => setItemToArchive(null)}
        onConfirm={confirmArchive}
        title="Archive Project"
        message="Archive this project? You can restore it from archived view."
        confirmText="Archive"
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Project"
        message="Delete this project and all its history? This cannot be undone."
        confirmText="Delete"
        danger={true}
      />

      {/* Edit Time Modal */}
      <Modal
        isOpen={!!editTimeState}
        onClose={() => setEditTimeState(null)}
        title="Edit Completed Time"
      >
        {editTimeState && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Adjust the completed time for this project. This lets you manually correct the timer if needed.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Completed Time
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    value={editTimeState.hours}
                    onChange={(e) => setEditTimeState({
                      ...editTimeState,
                      hours: Math.max(0, parseInt(e.target.value) || 0)
                    })}
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
                    value={editTimeState.minutes}
                    onChange={(e) => setEditTimeState({
                      ...editTimeState,
                      minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
                    })}
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
                onClick={() => setEditTimeState(null)}
              >
                Cancel
              </Button>
              <Button onClick={confirmEditTime}>
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
    </div>
  );
}
