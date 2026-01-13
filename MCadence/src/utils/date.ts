import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import weekday from 'dayjs/plugin/weekday';
import { TIMEZONE } from '@/lib/constants';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekday);

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

// Get Monday of current week (00:00) in America/New_York timezone
export function getWeekStart(date: Date = getNowInTimezone()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return new Date(monday.toLocaleString("en-US", { timeZone: TIMEZONE }));
}

// Get Sunday of current week (23:59:59) in America/New_York timezone
export function getWeekEnd(date: Date = getNowInTimezone()): Date {
  const weekStart = getWeekStart(date);
  const sunday = new Date(weekStart);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return new Date(sunday.toLocaleString("en-US", { timeZone: TIMEZONE }));
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
 * Week is Monday 00:00:00 to next Monday 00:00:00 (exclusive end).
 */
export function getThisWeekRangeNY(): PeriodRange {
  const now = getNowNY();
  // dayjs weekday: 0=Sunday in default locale, but we use weekday plugin
  // With weekday plugin, weekday(1) = Monday of current week
  const monday = now.weekday(1).startOf('day');
  const nextMonday = monday.add(7, 'day');
  
  return {
    startISO: monday.toISOString(),
    endISO: nextMonday.toISOString(),
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
