/**
 * Utilities for dates and times.
 */

/**
 * Formats a Date object or string as YYYY-MM-DD.
 * @param {Date|string} date 
 * @returns {string}
 */
export const formatYYYYMMDD = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a time string (HH:MM:SS) to (HH:MM AM/PM) or similar.
 * @param {string} timeStr 
 * @returns {string}
 */
export const formatTime12Hour = (timeStr) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
};

/**
 * Checks if a date is in the past.
 * @param {string|Date} dateVal 
 * @returns {boolean}
 */
export const isPastDate = (dateVal) => {
  if (!dateVal) return false;
  const target = new Date(dateVal);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target < today;
};
