'use client';

import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { CategoryEditorModal } from './CategoryEditorModal';
import { AppSettings, BackupFrequency, SwipeAction, SwipeConfig, Category, TabId, WeekStartDay } from '@/lib/types';
import { loadSettings, saveSettings, getTimeUntilNextBackup, performAutoBackup, DEFAULT_SETTINGS } from '@/lib/storage';
import { TAB_CONFIG } from '@/lib/constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveCategories: (categories: Category[]) => void;
}

// Backup frequency options for the dropdown
const BACKUP_FREQUENCY_OPTIONS: { value: BackupFrequency; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// Swipe action options
const SWIPE_ACTION_OPTIONS: { value: SwipeAction; label: string }[] = [
  { value: 'delete', label: 'Delete' },
  { value: 'archive', label: 'Archive' },
];

// Week start day options
const WEEK_START_DAY_OPTIONS: { value: WeekStartDay; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function SettingsModal({ isOpen, onClose, categories, onSaveCategories }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [nextBackupInfo, setNextBackupInfo] = useState<string>('');

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      const loadedSettings = loadSettings();
      setSettings(loadedSettings);
      setNextBackupInfo(getTimeUntilNextBackup(loadedSettings));
    }
  }, [isOpen]);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleSave = () => {
    saveSettings(settings);
    setToastMessage('Settings saved');
    onClose();
  };

  const handleBackupNow = () => {
    const result = performAutoBackup();
    if (result.success && result.filename) {
      // Update settings with new last backup date
      const updatedSettings = loadSettings();
      setSettings(updatedSettings);
      setNextBackupInfo(getTimeUntilNextBackup(updatedSettings));
      setToastMessage(`Backup created: ${result.filename}`);
    } else if (result.success) {
      setToastMessage('No backup needed yet');
    } else {
      setToastMessage(`Backup failed: ${result.error}`);
    }
  };

  const handleSwipeConfigChange = (
    tab: TabId,
    direction: 'left' | 'right',
    action: SwipeAction
  ) => {
    setSettings(prev => ({
      ...prev,
      swipeConfig: {
        ...prev.swipeConfig,
        [tab]: {
          ...prev.swipeConfig[tab],
          [direction]: action,
        },
      },
    }));
  };

  const handleCategoryEditorClose = () => {
    setShowCategoryEditor(false);
  };

  const handleCategorySave = (newCategories: Category[]) => {
    onSaveCategories(newCategories);
    setShowCategoryEditor(false);
    setToastMessage('Categories saved');
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Settings">
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Categories Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Categories</h3>
            <p className="text-xs text-gray-500 mb-3">
              Manage your task categories and subcategories
            </p>
            <Button
              variant="secondary"
              onClick={() => setShowCategoryEditor(true)}
              className="w-full"
            >
              Edit Categories
            </Button>
          </div>

          {/* Backup Frequency Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Backup Settings</h3>
            <p className="text-xs text-gray-500 mb-3">
              Automatically backup your data at regular intervals
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Backup Frequency
                </label>
                <select
                  value={settings.backupFrequency}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    backupFrequency: e.target.value as BackupFrequency,
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                >
                  {BACKUP_FREQUENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{nextBackupInfo}</span>
                {settings.lastBackupDate && (
                  <span>
                    Last: {new Date(settings.lastBackupDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              <Button
                variant="secondary"
                onClick={handleBackupNow}
                className="w-full"
              >
                Backup Now
              </Button>
            </div>
          </div>

          {/* Concurrency Settings Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Timer Settings</h3>
            <p className="text-xs text-gray-500 mb-3">
              Configure how time tracking works
            </p>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowConcurrentTimers}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  allowConcurrentTimers: e.target.checked,
                }))}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Allow concurrent timers
                </span>
                <p className="text-xs text-gray-500">
                  Enable multiple time tracking items to run simultaneously
                </p>
              </div>
            </label>
          </div>

          {/* Week Start Day Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Week Start</h3>
            <p className="text-xs text-gray-500 mb-3">
              Choose which day your week starts on. This affects recurring item due dates.
            </p>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Week Starts On
              </label>
              <select
                value={settings.weekStartDay}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  weekStartDay: parseInt(e.target.value, 10) as WeekStartDay,
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                {WEEK_START_DAY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swipe Motion Configuration Section */}
          <div className="pb-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Swipe Actions</h3>
            <p className="text-xs text-gray-500 mb-3">
              Configure what swipe gestures do in each tab
            </p>
            
            <div className="space-y-4">
              {(['dayToDay', 'hitMyGoal', 'spendMyTime'] as TabId[]).map((tab) => {
                const tabConfig = TAB_CONFIG[tab];
                const swipeConfig = settings.swipeConfig[tab];
                
                return (
                  <div key={tab} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{tabConfig.icon}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {tabConfig.label}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          ← Swipe Left
                        </label>
                        <select
                          value={swipeConfig.left}
                          onChange={(e) => handleSwipeConfigChange(
                            tab,
                            'left',
                            e.target.value as SwipeAction
                          )}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        >
                          {SWIPE_ACTION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Swipe Right →
                        </label>
                        <select
                          value={swipeConfig.right}
                          onChange={(e) => handleSwipeConfigChange(
                            tab,
                            'right',
                            e.target.value as SwipeAction
                          )}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        >
                          {SWIPE_ACTION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>

        {/* Toast Message */}
        {toastMessage && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-[60] animate-fade-in">
            {toastMessage}
          </div>
        )}
      </Modal>

      {/* Category Editor Modal */}
      <CategoryEditorModal
        isOpen={showCategoryEditor}
        onClose={handleCategoryEditorClose}
        categories={categories}
        onSave={handleCategorySave}
      />
    </>
  );
}
