'use client';

import { useState } from 'react';
import { RecurrenceFormSettings, Frequency } from '@/lib/types';
import { TIMEZONE_OPTIONS, FREQUENCY_OPTIONS, DEFAULT_TIMEZONE } from '@/lib/constants';

interface RecurrenceSelectorProps {
  value: RecurrenceFormSettings | undefined;
  onChange: (value: RecurrenceFormSettings | undefined) => void;
  className?: string;
}

export function RecurrenceSelector({ value, onChange, className = '' }: RecurrenceSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);

  const handleEnableChange = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled) {
      onChange({
        enabled: true,
        frequency: value?.frequency || 'weekly',
        totalOccurrences: value?.totalOccurrences ?? null,
        timezone: value?.timezone || DEFAULT_TIMEZONE,
      });
    } else {
      onChange(undefined);
    }
  };

  const handleFrequencyChange = (frequency: Frequency) => {
    if (value) {
      onChange({ ...value, frequency });
    }
  };

  const handleOccurrencesChange = (totalOccurrences: number | null) => {
    if (value) {
      onChange({ ...value, totalOccurrences });
    }
  };

  const handleTimezoneChange = (timezone: string) => {
    if (value) {
      onChange({ ...value, timezone });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Enable Recurrence Toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => handleEnableChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm font-medium text-gray-700">
            Enable Recurrence
          </span>
        </label>
      </div>

      {/* Recurrence Options - only show when enabled */}
      {isEnabled && value && (
        <div className="pl-6 space-y-3 border-l-2 border-blue-200">
          {/* Frequency Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Repeat
            </label>
            <select
              value={value.frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as Frequency)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Occurrences Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Stop After
            </label>
            <div className="flex gap-2 items-center">
              <select
                value={value.totalOccurrences === null ? 'forever' : 'custom'}
                onChange={(e) => {
                  if (e.target.value === 'forever') {
                    handleOccurrencesChange(null);
                  } else {
                    handleOccurrencesChange(value.totalOccurrences || 1);
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="forever">Forever</option>
                <option value="custom">Custom...</option>
              </select>
              
              {value.totalOccurrences !== null && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={value.totalOccurrences}
                    onChange={(e) => handleOccurrencesChange(parseInt(e.target.value) || 1)}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <span className="text-sm text-gray-600">times</span>
                </div>
              )}
            </div>
          </div>

          {/* Timezone Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Timezone
            </label>
            <select
              value={value.timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get display text for recurrence settings
export function getRecurrenceDisplayText(settings: RecurrenceFormSettings | undefined): string {
  if (!settings || !settings.enabled) return '';
  
  const frequency = FREQUENCY_OPTIONS.find(f => f.value === settings.frequency)?.label || settings.frequency;
  const occurrences = settings.totalOccurrences === null 
    ? 'forever' 
    : `${settings.totalOccurrences} times`;
  
  return `${frequency}, ${occurrences}`;
}
