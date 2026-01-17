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

// Default category ID for new items
export const DEFAULT_CATEGORY_ID = 'sub-default';

// Pre-populated categories with L1/L2 hierarchy
export const DEFAULT_CATEGORIES = [
  {
    id: 'cat-default',
    name: 'Default',
    color: '#3b82f6', // Blue
    subcategories: [
      { id: 'sub-default', name: 'General', icon: '🔵', parentId: 'cat-default' },
    ]
  },
  {
    id: 'cat-daily-essentials',
    name: '必要日常',
    color: '#000000', // Black
    subcategories: [
      { id: 'sub-sleep', name: '睡觉/休息', icon: '🛏️', parentId: 'cat-daily-essentials' },
      { id: 'sub-work', name: '工作', icon: '💼', parentId: 'cat-daily-essentials' },
      { id: 'sub-hygiene', name: '洗漱/臭美', icon: '💄', parentId: 'cat-daily-essentials' },
      { id: 'sub-eating', name: '吃饭', icon: '🍽️', parentId: 'cat-daily-essentials' },
      { id: 'sub-chores', name: '家务', icon: '🧹', parentId: 'cat-daily-essentials' },
      { id: 'sub-commute', name: '通勤', icon: '🚗', parentId: 'cat-daily-essentials' },
      { id: 'sub-family', name: '家庭', icon: '👨‍👩‍👧‍👦', parentId: 'cat-daily-essentials' },
      { id: 'sub-medical', name: '医疗', icon: '💊', parentId: 'cat-daily-essentials' },
      { id: 'sub-other', name: '其他杂事', icon: '🛠️', parentId: 'cat-daily-essentials' },
    ]
  },
  {
    id: 'cat-side-business',
    name: '副业',
    color: '#eab308', // Yellow
    subcategories: [
      { id: 'sub-side-prep', name: '副业筹备', icon: '🚀', parentId: 'cat-side-business' },
      { id: 'sub-job-change', name: '换工作', icon: '🔄', parentId: 'cat-side-business' },
      { id: 'sub-finance', name: '理财', icon: '💲', parentId: 'cat-side-business' },
      { id: 'sub-volunteer', name: '志愿', icon: '❤️', parentId: 'cat-side-business' },
    ]
  },
  {
    id: 'cat-growth',
    name: '兴趣/成长',
    color: '#10b981', // Green
    subcategories: [
      { id: 'sub-fitness', name: '健身/按摩/拉伸', icon: '💪', parentId: 'cat-growth' },
      { id: 'sub-social', name: '社交/助人/seminar', icon: '🔑', parentId: 'cat-growth' },
      { id: 'sub-reading', name: '读书', icon: '📚', parentId: 'cat-growth' },
      { id: 'sub-learning', name: '专项学习', icon: '🎓', parentId: 'cat-growth' },
      { id: 'sub-planning', name: '规划', icon: '📋', parentId: 'cat-growth' },
      { id: 'sub-art', name: '艺术/爱好', icon: '🎨', parentId: 'cat-growth' },
      { id: 'sub-language', name: '语言学习', icon: '🌍', parentId: 'cat-growth' },
    ]
  },
  {
    id: 'cat-leisure',
    name: '休闲放松',
    color: '#ef4444', // Red
    subcategories: [
      { id: 'sub-entertainment', name: '娱乐/购物', icon: '🎤', parentId: 'cat-leisure' },
      { id: 'sub-gathering', name: '聚会', icon: '🥂', parentId: 'cat-leisure' },
      { id: 'sub-travel', name: '旅行', icon: '✈️', parentId: 'cat-leisure' },
    ]
  },
  {
    id: 'cat-kids',
    name: '娃事相关',
    color: '#f97316', // Orange
    subcategories: [
      { id: 'sub-childcare', name: '带娃', icon: '👶', parentId: 'cat-kids' },
      { id: 'sub-education', name: '卷娃', icon: '🏆', parentId: 'cat-kids' },
      { id: 'sub-parenting', name: '育儿知识', icon: '🧩', parentId: 'cat-kids' },
      { id: 'sub-pregnancy', name: '孕产相关', icon: '🤰', parentId: 'cat-kids' },
    ]
  },
];

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

// Item Status Definitions
// Status is based on completion vs deadline:
// - active: Within deadline, not yet completed
// - done: Completed the goal before deadline
// - missed: Deadline passed without completion
//
// Archived is a separate flag (isArchived: boolean)
export const ITEM_STATUS = {
  ACTIVE: 'active' as const,
  DONE: 'done' as const,
  MISSED: 'missed' as const,
};

export type ItemStatusType = typeof ITEM_STATUS[keyof typeof ITEM_STATUS];

export const ITEM_STATUS_CONFIG = {
  [ITEM_STATUS.ACTIVE]: {
    label: 'Active',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  [ITEM_STATUS.DONE]: {
    label: 'Completed',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  [ITEM_STATUS.MISSED]: {
    label: 'Missed',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

// Urgency thresholds for recurring items (in hours)
export const URGENCY_RED_THRESHOLD_HOURS = 12; // Less than 12 hours = urgent (red)
export const URGENCY_YELLOW_THRESHOLD_HOURS = 24; // Less than 24 hours = warning (yellow)

// Default timezone
export const DEFAULT_TIMEZONE = 'America/New_York';

// Timezone options for user selection
export const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (EST/EDT)' },
  { value: 'America/Chicago', label: 'Central Time (CST/CDT)' },
  { value: 'America/Denver', label: 'Mountain Time (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PST/PDT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC' },
];

// Frequency options for recurrence
export const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Day', labelPlural: 'Days' },
  { value: 'weekly', label: 'Week', labelPlural: 'Weeks' },
  { value: 'monthly', label: 'Month', labelPlural: 'Months' },
  { value: 'annually', label: 'Year', labelPlural: 'Years' },
];

// Occurrence limit options
export const OCCURRENCE_OPTIONS = [
  { value: null, label: 'Forever' },
  { value: 1, label: '1 time' },
  { value: 2, label: '2 times' },
  { value: 3, label: '3 times' },
  { value: 4, label: '4 times' },
  { value: 5, label: '5 times' },
  { value: 10, label: '10 times' },
  { value: 12, label: '12 times' },
  { value: 52, label: '52 times' },
];

// Legacy alias for backward compatibility
export const TIMEZONE = DEFAULT_TIMEZONE;
