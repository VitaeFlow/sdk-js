/**
 * Date utilities for VitaeFlow SDK validation rules
 */

/**
 * Parse a date string that might be partial (YYYY, YYYY-MM, or YYYY-MM-DD)
 * Returns a Date object with missing components filled with defaults
 */
export function parsePartialDate(dateStr: string, fillEnd = false): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  // Handle full ISO date strings
  if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  // Handle partial dates (YYYY or YYYY-MM)
  const parts = dateStr.split('-');
  if (parts.length < 1 || parts.length > 3) {
    return null;
  }

  const year = parseInt(parts[0] || '');
  if (isNaN(year) || year < 1900 || year > 2100) {
    return null;
  }

  let month = 1;
  let day = 1;

  if (parts.length >= 2) {
    month = parseInt(parts[1] || '');
    if (isNaN(month) || month < 1 || month > 12) {
      return null;
    }
  }

  if (parts.length >= 3) {
    day = parseInt(parts[2] || '');
    if (isNaN(day) || day < 1 || day > 31) {
      return null;
    }
  } else if (fillEnd) {
    // Fill end dates with last day of month/year
    if (parts.length === 1) {
      month = 12;
      day = 31;
    } else {
      day = new Date(year, month, 0).getDate(); // Last day of month
    }
  }

  const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Check if a date is in the future (allowing for some tolerance)
 */
export function isFutureDate(date: Date, toleranceDays = 30): boolean {
  const now = new Date();
  const tolerance = toleranceDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
  return date.getTime() > (now.getTime() + tolerance);
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: Date, referenceDate = new Date()): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Calculate duration between two dates in years (with decimal precision)
 */
export function calculateDurationYears(startDate: Date, endDate: Date): number {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25); // Account for leap years
  return Math.round(diffYears * 10) / 10; // Round to 1 decimal place
}

/**
 * Check if start date is before or equal to end date
 */
export function isChronological(startDate: Date, endDate: Date): boolean {
  return startDate.getTime() <= endDate.getTime();
}

/**
 * Format date for error messages
 */
export function formatDateForError(date: Date): string {
  return date.toISOString().split('T')[0] || date.toISOString(); // YYYY-MM-DD format
}

/**
 * Get current date for consistent "now" reference in validation
 */
export function getCurrentDate(): Date {
  return new Date();
}

/**
 * Check if a date string represents a valid date
 */
export function isValidDateString(dateStr: string): boolean {
  return parsePartialDate(dateStr) !== null;
}