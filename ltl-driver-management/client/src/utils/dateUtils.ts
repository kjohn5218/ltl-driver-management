import { addDays, isWeekend, format } from 'date-fns';

/**
 * Get the next business day from a given date
 * Skips weekends (Saturday and Sunday)
 *
 * @param date - The starting date
 * @returns The next business day
 */
export function getNextBusinessDay(date: Date = new Date()): Date {
  let nextDay = addDays(date, 1);

  // Skip weekends
  while (isWeekend(nextDay)) {
    nextDay = addDays(nextDay, 1);
  }

  return nextDay;
}

/**
 * Get the next business day as a formatted string (YYYY-MM-DD)
 *
 * @param date - The starting date
 * @returns The next business day formatted as YYYY-MM-DD
 */
export function getNextBusinessDayFormatted(date: Date = new Date()): string {
  return format(getNextBusinessDay(date), 'yyyy-MM-dd');
}

/**
 * Check if a date is a business day (not a weekend)
 *
 * @param date - The date to check
 * @returns True if it's a business day
 */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date);
}

/**
 * Add business days to a date (skipping weekends)
 *
 * @param date - The starting date
 * @param days - Number of business days to add
 * @returns The resulting date
 */
export function addBusinessDays(date: Date, days: number): Date {
  let result = new Date(date);
  let addedDays = 0;

  while (addedDays < days) {
    result = addDays(result, 1);
    if (!isWeekend(result)) {
      addedDays++;
    }
  }

  return result;
}
