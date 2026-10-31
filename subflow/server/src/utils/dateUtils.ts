/**
 * Date arithmetic utility for recurring billing frequencies.
 * Handles month-end capping (e.g. Jan 31 -> Feb 28/29) correctly.
 */

export function calculateNextBillingDate(fromDate: Date, frequency: string): Date {
  const current = new Date(fromDate);
  const next = new Date(current);

  const freq = frequency.toUpperCase();

  switch (freq) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;

    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;

    case 'MONTHLY': {
      const currentDay = current.getDate();
      // Set to 1st of next month to safely advance month
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);

      // Find max days in the target month
      const maxDaysInTargetMonth = new Date(
        next.getFullYear(),
        next.getMonth() + 1,
        0
      ).getDate();

      // Capped at the last day of target month if currentDay exceeds it
      next.setDate(Math.min(currentDay, maxDaysInTargetMonth));
      break;
    }

    case 'YEARLY': {
      const currentDay = current.getDate();
      const currentMonth = current.getMonth();
      const targetYear = current.getFullYear() + 1;

      // Handle leap year edge case (Feb 29 -> Feb 28 on non-leap year)
      const maxDaysInMonth = new Date(targetYear, currentMonth + 1, 0).getDate();
      next.setFullYear(targetYear);
      next.setDate(Math.min(currentDay, maxDaysInMonth));
      break;
    }

    default:
      // Default to 1 month
      next.setMonth(next.getMonth() + 1);
      break;
  }

  return next;
}

export function isPastDate(date: Date): boolean {
  return new Date(date).getTime() < Date.now();
}

export function isSameOrBefore(date1: Date, date2: Date): boolean {
  return new Date(date1).getTime() <= new Date(date2).getTime();
}
