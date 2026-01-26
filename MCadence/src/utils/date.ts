import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import weekday from 'dayjs/plugin/weekday';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import { TIMEZONE, URGENCY_RED_THRESHOLD_HOURS, URGENCY_YELLOW_THRESHOLD_HOURS } from '@/lib/constants';
import { Frequency, RecurrenceSettings, WeekStartDay } from '@/lib/types';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekday);
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

// Default week start day (Monday)
const DEFAULT_WEEK_START_DAY: WeekStartDay = 1;

// ============================================================================
// Core Time Functions
// ============================================================================

// Get current date in America/New_York timezone
export function getNowInTimezone(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
}

// Get current dayjs instance in NY timezone
export function getNowNY(): dayjs.Dayjs {
  return dayjs().tz(TIMEZONE);
}

/**
 * Get the start of current week (00:00) in America/New_York timezone.
 * @param date The date to calculate from (defaults to now)
 * @param weekStartDay The day the week starts on (0=Sunday, 1=Monday, etc.) - defaults to Monday
 */
export function getWeekStart(date: Date = getNowInTimezone(), weekStartDay: WeekStartDay = DEFAULT_WEEK_START_DAY): Date {
  const d = new Date(date);
  const currentDay = d.getDay(); // 0=Sunday, 1=Monday, ...
  
  // Calculate days to subtract to get to week start
  let daysToSubtract = currentDay - weekStartDay;
  if (daysToSubtract < 0) {
    daysToSubtract += 7; // Wrap around if needed
  }
  
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);
  return new Date(weekStart.toLocaleString("en-US", { timeZone: TIMEZONE }));
}

/**
 * Get the end of current week (23:59:59) in America/New_York timezone.
 * @param date The date to calculate from (defaults to now)
 * @param weekStartDay The day the week starts on (0=Sunday, 1=Monday, etc.) - defaults to Monday
 */
export function getWeekEnd(date: Date = getNowInTimezone(), weekStartDay: WeekStartDay = DEFAULT_WEEK_START_DAY): Date {
  const weekStart = getWeekStart(date, weekStartDay);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return new Date(weekEnd.toLocaleString("en-US", { timeZone: TIMEZONE }));
}

// ============================================================================
// AI Insight Period Helpers
// ============================================================================

export interface PeriodRange {
  startISO: string;
  endISO: string;
}

/**
 * Get "This Week" range in NY timezone.
 * Week is weekStartDay 00:00:00 to next weekStartDay 00:00:00 (exclusive end).
 * @param weekStartDay The day the week starts on (0=Sunday, 1=Monday, etc.) - defaults to Monday
 */
export function getThisWeekRangeNY(weekStartDay: WeekStartDay = DEFAULT_WEEK_START_DAY): PeriodRange {
  const now = getNowNY();
  const currentDay = now.day(); // 0=Sunday, 1=Monday, ...
  
  // Calculate days to subtract to get to week start
  let daysToSubtract = currentDay - weekStartDay;
  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }
  
  const weekStart = now.subtract(daysToSubtract, 'day').startOf('day');
  const nextWeekStart = weekStart.add(7, 'day');
  
  return {
    startISO: weekStart.toISOString(),
    endISO: nextWeekStart.toISOString(),
  };
}

/**
 * Get "Last 7 Days" range in NY timezone.
 * Rolling window from now-7d to now.
 */
export function getLast7DaysRangeNY(): PeriodRange {
  const now = getNowNY();
  const start = now.subtract(7, 'day').startOf('day');
  
  return {
    startISO: start.toISOString(),
    endISO: now.toISOString(),
  };
}

/**
 * Get custom date range in NY timezone.
 * @param startDate YYYY-MM-DD format
 * @param endDate YYYY-MM-DD format
 * Returns fallback to last 7 days if dates are invalid/empty.
 */
export function getCustomRangeNY(startDate: string, endDate: string): PeriodRange {
  // Validate inputs - if empty or invalid, fallback to last 7 days
  if (!startDate || !endDate || startDate.trim() === '' || endDate.trim() === '') {
    return getLast7DaysRangeNY();
  }
  
  const start = dayjs.tz(startDate, TIMEZONE);
  const end = dayjs.tz(endDate, TIMEZONE);
  
  // Check if dates are valid
  if (!start.isValid() || !end.isValid()) {
    return getLast7DaysRangeNY();
  }
  
  return {
    startISO: start.startOf('day').toISOString(),
    endISO: end.endOf('day').toISOString(),
  };
}

/**
 * Parse an ISO string and return a dayjs instance in NY timezone.
 */
export function parseISOInNY(isoString: string): dayjs.Dayjs {
  return dayjs(isoString).tz(TIMEZONE);
}

/**
 * Check if a timestamp falls within a period range [start, end).
 * @param timestamp ISO string to check
 * @param startISO Period start (inclusive)
 * @param endISO Period end (exclusive)
 */
export function isInPeriod(timestamp: string, startISO: string, endISO: string): boolean {
  const ts = dayjs(timestamp);
  const start = dayjs(startISO);
  const end = dayjs(endISO);
  return ts.isAfter(start) || ts.isSame(start, 'millisecond') ? ts.isBefore(end) : false;
}

/**
 * Get the day of week for a timestamp in NY timezone.
 * Returns 0-6 where 0=Sunday, 1=Monday, etc.
 */
export function getDayOfWeekNY(timestamp: string): number {
  return parseISOInNY(timestamp).day();
}

/**
 * Get the hour (0-23) for a timestamp in NY timezone.
 */
export function getHourNY(timestamp: string): number {
  return parseISOInNY(timestamp).hour();
}

/**
 * Check if a timestamp is during daytime (6am-6pm) in NY timezone.
 */
export function isDayTimeNY(timestamp: string): boolean {
  const hour = getHourNY(timestamp);
  return hour >= 6 && hour < 18;
}

/**
 * Calculate minutes difference between two ISO timestamps.
 */
export function getMinutesDiff(startISO: string, endISO: string): number {
  const start = dayjs(startISO);
  const end = dayjs(endISO);
  return end.diff(start, 'minute');
}

/**
 * Check if a timestamp is older than N days from now in NY timezone.
 */
export function isOlderThanDaysNY(timestamp: string, days: number): boolean {
  const ts = parseISOInNY(timestamp);
  const cutoff = getNowNY().subtract(days, 'day');
  return ts.isBefore(cutoff);
}

/**
 * Get the number of days between a timestamp and now in NY timezone.
 */
export function getDaysDiffFromNow(timestamp: string): number {
  const ts = parseISOInNY(timestamp);
  const now = getNowNY();
  return now.diff(ts, 'day');
}

/**
 * Format a date for display in YYYY-MM-DD format.
 */
export function formatDateYMD(date: Date | string | dayjs.Dayjs): string {
  return dayjs(date).tz(TIMEZONE).format('YYYY-MM-DD');
}

// Format minutes as "Xh Ym"
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Calculate period progress (0-1)
export function getPeriodProgress(periodStart: Date, periodEnd: Date, now: Date = getNowInTimezone()): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  const elapsed = now.getTime() - periodStart.getTime();
  return Math.max(0, Math.min(1, elapsed / total));
}

// Check if week has rolled over and needs reset
export function needsWeekReset(currentPeriodEnd: string, now: Date = getNowInTimezone()): boolean {
  const periodEnd = new Date(currentPeriodEnd);
  return now > periodEnd;
}

// Format date for display
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    timeZone: TIMEZONE 
  });
}

// Format datetime for display
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE 
  });
}

// Get ISO string in local timezone
export function toISOStringLocal(date: Date = getNowInTimezone()): string {
  return date.toISOString();
}

// ============================================================================
// Urgency Helpers for Recurring Items
// ============================================================================

export type UrgencyStatus = 'overdue' | 'urgent' | 'warning' | 'normal' | 'complete';

/**
 * Calculate hours remaining until next due date.
 * Returns negative number if overdue.
 */
export function getHoursUntilDue(nextDueISO: string | undefined): number | null {
  if (!nextDueISO) return null;
  
  const now = getNowNY();
  const due = dayjs(nextDueISO).tz(TIMEZONE);
  
  if (!due.isValid()) return null;
  
  return due.diff(now, 'hour', true); // Use true for decimal precision
}

/**
 * Get urgency status based on hours remaining.
 * - overdue: past due date
 * - urgent (red): less than 12 hours remaining
 * - warning (yellow): less than 24 hours remaining
 * - normal: more than 24 hours remaining
 */
export function getUrgencyStatus(
  nextDueISO: string | undefined,
  isComplete: boolean = false
): UrgencyStatus {
  if (isComplete) return 'complete';
  if (!nextDueISO) return 'normal';
  
  const hoursRemaining = getHoursUntilDue(nextDueISO);
  if (hoursRemaining === null) return 'normal';
  
  if (hoursRemaining < 0) return 'overdue';
  if (hoursRemaining <= URGENCY_RED_THRESHOLD_HOURS) return 'urgent';
  if (hoursRemaining <= URGENCY_YELLOW_THRESHOLD_HOURS) return 'warning';
  return 'normal';
}

/**
 * Get urgency status based on time remaining vs work remaining.
 * Alert when: time left till due < 3X of the time remaining to finish
 *
 * - overdue: past due date
 * - urgent (red): time left < 1.5X of remaining work
 * - warning (yellow): time left < 3X of remaining work
 * - normal: plenty of time
 * - complete: task is finished
 *
 * @param nextDueISO The deadline (ISO string)
 * @param remainingMinutes Minutes of work remaining to complete the task
 * @param isComplete Whether the task is already complete
 */
export function getUrgencyStatusWithWork(
  nextDueISO: string | undefined,
  remainingMinutes: number,
  isComplete: boolean = false
): UrgencyStatus {
  if (isComplete || remainingMinutes <= 0) return 'complete';
  if (!nextDueISO) return 'normal';
  
  const hoursRemaining = getHoursUntilDue(nextDueISO);
  if (hoursRemaining === null) return 'normal';
  
  if (hoursRemaining < 0) return 'overdue';
  
  // Convert remaining work to hours for comparison
  const workRemainingHours = remainingMinutes / 60;
  
  // Alert thresholds based on work remaining:
  // - urgent: less than 1.5X work time remaining
  // - warning: less than 3X work time remaining
  if (hoursRemaining < workRemainingHours * 1.5) return 'urgent';
  if (hoursRemaining < workRemainingHours * 3) return 'warning';
  
  return 'normal';
}

/**
 * Format time remaining until due date for display.
 * e.g., "2h 30m", "Due in 1d", "Overdue"
 */
export function formatTimeUntilDue(nextDueISO: string | undefined): string {
  if (!nextDueISO) return '';
  
  const hoursRemaining = getHoursUntilDue(nextDueISO);
  if (hoursRemaining === null) return '';
  
  if (hoursRemaining < 0) {
    // Overdue
    const overdueHours = Math.abs(hoursRemaining);
    if (overdueHours < 1) {
      return `Overdue ${Math.round(overdueHours * 60)}m`;
    } else if (overdueHours < 24) {
      return `Overdue ${Math.round(overdueHours)}h`;
    } else {
      return `Overdue ${Math.round(overdueHours / 24)}d`;
    }
  }
  
  // Future
  if (hoursRemaining < 1) {
    return `${Math.round(hoursRemaining * 60)}m left`;
  } else if (hoursRemaining < 24) {
    const hours = Math.floor(hoursRemaining);
    const mins = Math.round((hoursRemaining - hours) * 60);
    return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
  } else {
    return `${Math.round(hoursRemaining / 24)}d left`;
  }
}

/**
 * Format the due date display text for an item.
 * Shows time remaining if there's a due date, or "- no due date" if not.
 * Used for consistent due date display across all tabs.
 *
 * @param dueDate The due date ISO string (from item.dueDate or item.recurrence?.nextDue)
 * @param isComplete Whether the item is completed
 * @returns Display string for the due date
 */
export function formatDueDateDisplay(dueDate: string | null | undefined, isComplete: boolean = false): string {
  if (!dueDate) {
    return '- no due date';
  }
  
  if (isComplete) {
    // For completed items, just show the date
    return formatDateYMD(dueDate);
  }
  
  return formatTimeUntilDue(dueDate) || formatDateYMD(dueDate);
}

/**
 * Get CSS classes for urgency status.
 */
export function getUrgencyClasses(status: UrgencyStatus): {
  text: string;
  bg: string;
  border: string;
  badge: string;
} {
  switch (status) {
    case 'overdue':
      return {
        text: 'text-red-600 font-semibold',
        bg: 'bg-red-50',
        border: 'border-red-300',
        badge: 'bg-red-100 text-red-700',
      };
    case 'urgent':
      return {
        text: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        badge: 'bg-red-100 text-red-700 animate-pulse',
      };
    case 'warning':
      return {
        text: 'text-yellow-600',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        badge: 'bg-yellow-100 text-yellow-700',
      };
    case 'complete':
      return {
        text: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-200',
        badge: 'bg-green-100 text-green-700',
      };
    default:
      return {
        text: 'text-gray-600',
        bg: '',
        border: '',
        badge: 'bg-gray-100 text-gray-600',
      };
  }
}

// ============================================================================
// Recurrence Calculation Helpers
// ============================================================================

/**
 * Calculate the next due date based on frequency and interval using calendar boundaries.
 * Due dates are at midnight EST of the next calendar period:
 * - Daily: midnight of next N days
 * - Weekly: midnight of start of next N weeks (based on weekStartDay)
 * - Monthly: midnight of 1st of month after N months
 * - Annually: midnight of January 1st after N years
 *
 * @param currentDue The current due date (ISO string) - used to determine current period
 * @param frequency The recurrence frequency
 * @param tz The timezone to use for calculation
 * @param interval How many periods to skip (default 1)
 * @param weekStartDay The day the week starts on (0=Sunday, 1=Monday, etc.) - defaults to Monday
 * @returns ISO string for the next due date
 */
export function calculateNextDue(
  currentDue: string,
  frequency: Frequency,
  tz: string = TIMEZONE,
  interval: number = 1,
  weekStartDay: WeekStartDay = DEFAULT_WEEK_START_DAY
): string {
  const now = getNowNY();
  const n = Math.max(1, interval); // Ensure at least 1
  
  switch (frequency) {
    case 'daily':
      // Next N days at midnight EST
      return now.add(n, 'day').startOf('day').toISOString();
    case 'weekly':
      // Next N weeks - week start day at midnight EST
      const currentDay = now.day();
      let daysToWeekStart = currentDay - weekStartDay;
      if (daysToWeekStart < 0) {
        daysToWeekStart += 7;
      }
      const currentWeekStart = now.subtract(daysToWeekStart, 'day').startOf('day');
      const nextWeekStart = now.isAfter(currentWeekStart) || now.isSame(currentWeekStart)
        ? currentWeekStart.add(n * 7, 'day')
        : currentWeekStart.add((n - 1) * 7, 'day');
      return nextWeekStart.toISOString();
    case 'monthly':
      // 1st of month after N months at midnight EST
      return now.add(n, 'month').startOf('month').toISOString();
    case 'annually':
      // January 1st after N years at midnight EST
      return now.add(n, 'year').startOf('year').toISOString();
    default:
      // Default to weekly with interval
      const defaultDay = now.day();
      let defaultDaysToWeekStart = defaultDay - weekStartDay;
      if (defaultDaysToWeekStart < 0) {
        defaultDaysToWeekStart += 7;
      }
      const defaultWeekStart = now.subtract(defaultDaysToWeekStart, 'day').startOf('day');
      return now.isAfter(defaultWeekStart) || now.isSame(defaultWeekStart)
        ? defaultWeekStart.add(n * 7, 'day').toISOString()
        : defaultWeekStart.add((n - 1) * 7, 'day').toISOString();
  }
}

/**
 * Get the initial due date for a new recurring item.
 * This is the end of the current period:
 * - Daily: midnight tonight (end of today)
 * - Weekly: start of next week at midnight (end of this week)
 * - Monthly: 1st of next month at midnight (end of this month)
 * - Annually: January 1st of next year at midnight (end of this year)
 *
 * @param frequency The recurrence frequency
 * @param tz The timezone to use for calculation
 * @param weekStartDay The day the week starts on (0=Sunday, 1=Monday, etc.) - defaults to Monday
 */
export function getInitialDueDate(
  frequency: Frequency,
  tz: string = TIMEZONE,
  weekStartDay: WeekStartDay = DEFAULT_WEEK_START_DAY
): string {
  const now = getNowNY();
  
  switch (frequency) {
    case 'daily':
      // End of today = midnight tomorrow
      return now.add(1, 'day').startOf('day').toISOString();
    case 'weekly':
      // End of this week = start of next week at midnight
      const currentDay = now.day();
      let daysToWeekStart = currentDay - weekStartDay;
      if (daysToWeekStart < 0) {
        daysToWeekStart += 7;
      }
      const currentWeekStart = now.subtract(daysToWeekStart, 'day').startOf('day');
      const nextWeekStart = currentWeekStart.add(7, 'day');
      return nextWeekStart.toISOString();
    case 'monthly':
      // End of this month = 1st of next month
      return now.add(1, 'month').startOf('month').toISOString();
    case 'annually':
      // End of this year = January 1st of next year
      return now.add(1, 'year').startOf('year').toISOString();
    default:
      // Default to weekly
      const defaultDay = now.day();
      let defaultDaysToWeekStart = defaultDay - weekStartDay;
      if (defaultDaysToWeekStart < 0) {
        defaultDaysToWeekStart += 7;
      }
      const defaultWeekStart = now.subtract(defaultDaysToWeekStart, 'day').startOf('day').add(7, 'day');
      return defaultWeekStart.toISOString();
  }
}

/**
 * Get the updated recurrence settings after completing an occurrence.
 * Returns null if the recurrence should be archived (limit reached).
 * @param recurrence The current recurrence settings
 * @returns Updated recurrence settings or null if limit reached
 */
export function advanceRecurrence(
  recurrence: RecurrenceSettings
): RecurrenceSettings | null {
  const newCompletedOccurrences = recurrence.completedOccurrences + 1;
  
  // Check if occurrence limit reached
  if (recurrence.totalOccurrences !== null && newCompletedOccurrences >= recurrence.totalOccurrences) {
    return null; // Signal to archive the item
  }
  
  const nextDue = calculateNextDue(
    recurrence.nextDue || new Date().toISOString(),
    recurrence.frequency,
    recurrence.timezone,
    recurrence.interval || 1
  );
  
  return {
    ...recurrence,
    completedOccurrences: newCompletedOccurrences,
    nextDue,
  };
}

/**
 * Check if a recurring item should be auto-reset (not completed yet in current period).
 * Used for determining if item needs attention.
 */
export function isRecurrenceOverdue(nextDue: string | undefined): boolean {
  if (!nextDue) return false;
  
  const now = getNowNY();
  const due = dayjs(nextDue).tz(TIMEZONE);
  
  return now.isAfter(due);
}

// ============================================================================
// Period Key Helpers - For date-tagged recurring items
// Period key is always the DUE DATE (end of period) in YYYYMMDD format
// ============================================================================

/**
 * Generate a period key for the current period based on frequency.
 * The period key is the DUE DATE (last day of the period) in YYYYMMDD format:
 * - Daily: "20260113" (today's date - due at end of today)
 * - Weekly: "20260119" (last day of week based on weekStartDay)
 * - Monthly: "20260131" (last day of month)
 * - Annually: "20261231" (December 31st)
 *
 * @param frequency The recurrence frequency
 * @param date Optional date to use (defaults to now in EST)
 * @param weekStartDay The day the week starts on (0=Sunday, 1=Monday, etc.) - defaults to Monday
 * @returns Period key string in YYYYMMDD format
 */
export function getCurrentPeriodKey(frequency: Frequency, date?: dayjs.Dayjs, weekStartDay: WeekStartDay = DEFAULT_WEEK_START_DAY): string {
  const d = date || getNowNY();
  
  switch (frequency) {
    case 'daily':
      // Due at end of today
      return d.format('YYYYMMDD');
    case 'weekly':
      // Due at end of week (day before next week start)
      const currentDay = d.day();
      let daysToWeekStart = currentDay - weekStartDay;
      if (daysToWeekStart < 0) {
        daysToWeekStart += 7;
      }
      // Week starts on weekStartDay, so it ends the day before
      const currentWeekStart = d.subtract(daysToWeekStart, 'day').startOf('day');
      const weekEnd = currentWeekStart.add(6, 'day'); // 6 days after week start = last day of week
      return weekEnd.format('YYYYMMDD');
    case 'monthly':
      // Due at end of month
      return d.endOf('month').format('YYYYMMDD');
    case 'annually':
      // Due at end of year (Dec 31)
      return d.endOf('year').format('YYYYMMDD');
    default:
      return d.format('YYYYMMDD');
  }
}

/**
 * Generate the period key for the NEXT period.
 * @param frequency The recurrence frequency
 * @param date Optional date to use (defaults to now in EST)
 * @param weekStartDay The day the week starts on (0=Sunday, 1=Monday, etc.) - defaults to Monday
 */
export function getNextPeriodKey(frequency: Frequency, date?: dayjs.Dayjs, weekStartDay: WeekStartDay = DEFAULT_WEEK_START_DAY): string {
  const d = date || getNowNY();
  
  switch (frequency) {
    case 'daily':
      return d.add(1, 'day').format('YYYYMMDD');
    case 'weekly':
      // Next week's end date
      const currentDay = d.day();
      let daysToWeekStart = currentDay - weekStartDay;
      if (daysToWeekStart < 0) {
        daysToWeekStart += 7;
      }
      const currentWeekStart = d.subtract(daysToWeekStart, 'day').startOf('day');
      const nextWeekEnd = currentWeekStart.add(13, 'day'); // 7 days to next week start + 6 days to week end
      return nextWeekEnd.format('YYYYMMDD');
    case 'monthly':
      return d.add(1, 'month').endOf('month').format('YYYYMMDD');
    case 'annually':
      return d.add(1, 'year').endOf('year').format('YYYYMMDD');
    default:
      return d.add(1, 'day').format('YYYYMMDD');
  }
}

/**
 * Format period key for display in item title.
 * @param baseTitle The original item title
 * @param periodKey The period key (YYYYMMDD)
 * @returns Formatted title like "睡觉-20260113"
 */
export function formatTitleWithPeriod(baseTitle: string, periodKey: string): string {
  return `${baseTitle}-${periodKey}`;
}

/**
 * Parse a title to extract base title and period key.
 * @param title The full title (may include period suffix)
 * @returns Object with baseTitle and periodKey (periodKey may be undefined)
 */
export function parseTitlePeriod(title: string): { baseTitle: string; periodKey?: string } {
  // Match pattern: "Title-YYYYMMDD" (8 digits at end)
  const match = title.match(/^(.+)-(\d{8})$/);
  
  if (match) {
    return {
      baseTitle: match[1],
      periodKey: match[2],
    };
  }
  
  return { baseTitle: title };
}

/**
 * Check if the current period has passed (need to create new item).
 * @param periodKey The period key (YYYYMMDD) to check
 * @param frequency The recurrence frequency (not used since periodKey is always YYYYMMDD)
 * @returns true if we're now past that date
 */
export function isPeriodPassed(periodKey: string, frequency: Frequency): boolean {
  const now = getNowNY();
  const dueDate = dayjs.tz(periodKey, 'YYYYMMDD', TIMEZONE).endOf('day');
  return now.isAfter(dueDate);
}

/**
 * Get the due date (ISO string) for a given period key.
 * The period key IS the due date, so we convert to midnight of the next day.
 */
export function getPeriodDueDate(periodKey: string): string {
  // Period key is YYYYMMDD, due at midnight of next day (00:00:00 of periodKey+1)
  const dueDate = dayjs.tz(periodKey, 'YYYYMMDD', TIMEZONE).add(1, 'day').startOf('day');
  return dueDate.toISOString();
}
