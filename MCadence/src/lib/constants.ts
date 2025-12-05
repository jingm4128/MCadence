export const STORAGE_KEY = 'mcadence_state_v1';

export const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6', class: 'bg-blue-500' },
  { name: 'Green', value: '#10b981', class: 'bg-green-500' },
  { name: 'Red', value: '#ef4444', class: 'bg-red-500' },
  { name: 'Purple', value: '#8b5cf6', class: 'bg-purple-500' },
  { name: 'Orange', value: '#f97316', class: 'bg-orange-500' },
  { name: 'Pink', value: '#ec4899', class: 'bg-pink-500' },
  { name: 'Yellow', value: '#eab308', class: 'bg-yellow-500' },
  { name: 'Teal', value: '#14b8a6', class: 'bg-teal-500' },
  { name: 'Indigo', value: '#6366f1', class: 'bg-indigo-500' },
  { name: 'Gray', value: '#6b7280', class: 'bg-gray-500' },
];

export const DEFAULT_COLOR = PRESET_COLORS[0]; // Blue

export const TAB_CONFIG = {
  dayToDay: {
    id: 'dayToDay' as const,
    label: 'Day to Day',
    icon: '📝',
    description: 'Random tasks and to-dos',
  },
  hitMyGoal: {
    id: 'hitMyGoal' as const,
    label: 'Hit My Goal',
    icon: '🎯',
    description: 'Challenges and high-satisfaction tasks',
  },
  spendMyTime: {
    id: 'spendMyTime' as const,
    label: 'Spend My Time',
    icon: '⏱️',
    description: 'Time tracking for recurring projects',
  },
};

export const DEBOUNCE_MS = 300;

export const WEEKLY_PROGRESS_ALERT_THRESHOLD = 0.8; // 80%

// America/New_York timezone constants
export const TIMEZONE = 'America/New_York';
