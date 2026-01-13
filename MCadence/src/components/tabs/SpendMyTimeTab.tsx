'use client';

import { useState, useEffect } from 'react';
import { useAppState } from '@/lib/state';
import { TimeItemForm, isTimeProject, RecurrenceFormSettings } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/Modal';
import { CategorySelector, getCategoryColor, getCategoryIcon, getCategoryDisplayName } from '@/components/ui/CategorySelector';
import { RecurrenceSelector, getRecurrenceDisplayText } from '@/components/ui/RecurrenceSelector';
import { WEEKLY_PROGRESS_ALERT_THRESHOLD } from '@/lib/constants';
import { formatMinutes, getPeriodProgress, getNowInTimezone, needsWeekReset } from '@/utils/date';

export function SpendMyTimeTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [itemToArchive, setItemToArchive] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
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
    deleteItem,
    getActiveTimerItem 
  } = useAppState();

  const items = getItemsByTab('spendMyTime').filter(isTimeProject);
  const archivedItems = getItemsByTab('spendMyTime', true).filter(item => item.status === 'archived' && isTimeProject(item));
  const activeTimerProject = getActiveTimerItem();

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

  const getProjectStatus = (project: any) => {
    if (project.status === 'archived') return 'archived';
    
    const now = getNowInTimezone();
    const periodStart = new Date(project.periodStart);
    const periodEnd = new Date(project.periodEnd);
    
    // Check if week has rolled over
    if (needsWeekReset(project.periodEnd)) {
      return 'overdue';
    }
    
    // Check if project is overdue
    if (now > periodEnd && project.completedMinutes < project.requiredMinutes) {
      return 'overdue';
    }
    
    // Check if project should show warning
    const periodProgress = getPeriodProgress(periodStart, periodEnd, now);
    const projectProgress = project.completedMinutes / project.requiredMinutes;
    
    if (periodProgress >= WEEKLY_PROGRESS_ALERT_THRESHOLD && projectProgress < 1) {
      return 'warning';
    }
    
    return 'normal';
  };

  const formatTimeRemaining = (project: any) => {
    if (project.status === 'archived') return '';
    
    const remaining = project.requiredMinutes - project.completedMinutes;
    if (remaining <= 0) return 'Complete!';
    
    return `${formatMinutes(Math.abs(remaining))} remaining`;
  };

  const getElapsedTime = (project: any) => {
    if (!project.currentSessionStart) return '';
    
    const now = new Date();
    const sessionStart = new Date(project.currentSessionStart);
    const elapsedMinutes = Math.floor((now.getTime() - sessionStart.getTime()) / (1000 * 60));
    
    return `${formatMinutes(elapsedMinutes)} elapsed`;
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

      {/* Active Timer Display */}
      {activeTimerProject && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary-900">{activeTimerProject.title}</h3>
              <p className="text-sm text-primary-700">Timer running</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-mono text-primary-900">
                {getElapsedTime(activeTimerProject)}
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => stopTimer(activeTimerProject.id)}
              >
                Stop
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Projects List */}
      {showArchive ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 mb-4">Archived projects</p>
          {archivedItems.map((project) => (
            <div
              key={project.id}
              className="bg-white p-4 rounded-lg border border-gray-200 opacity-60"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-700 line-through">{project.title}</h3>
                  {project.categoryId && (
                    <span className="text-sm text-gray-500">{project.categoryId}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
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
            
            return (
              <div
                key={project.id}
                className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm swipe-hint cursor-pointer transition-all category-transition hover-lift ${
                  isActive ? 'ring-2 ring-primary-500 border-primary-500' : 'hover:shadow-md'
                } ${status === 'overdue' ? 'border-red-200' : ''}`}
                style={{ borderLeftColor: getCategoryColor(project.categoryId), borderLeftWidth: '4px' }}
                onClick={() => handleProjectClick(project.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h3 className={`font-medium ${
                      status === 'overdue' ? 'text-red-600' :
                      isActive ? 'text-primary-900' : 'text-gray-900'
                    }`}>
                      {project.title}
                    </h3>
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
                
                <ProgressBar
                  value={progress}
                  showWarning={status === 'warning'}
                  className="mb-2"
                />
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {formatMinutes(project.completedMinutes)} / {formatMinutes(project.requiredMinutes)}
                  </span>
                  <span className={`${
                    status === 'overdue' ? 'text-red-600 font-medium' : 
                    progress >= 1 ? 'text-green-600 font-medium' : 'text-gray-600'
                  }`}>
                    {formatTimeRemaining(project)}
                  </span>
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
    </div>
  );
}
