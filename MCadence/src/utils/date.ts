import { TIMEZONE } from '@/lib/constants';

// Get current date in America/New_York timezone
export function getNowInTimezone(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
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
