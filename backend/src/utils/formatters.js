/**
 * Utilities for formatting text, names, and numbers.
 */

/**
 * Formats a number to Soles currency (S/ XX.XX) or returns 'A consultar'.
 * @param {number|string} amount 
 * @returns {string}
 */
export const formatSoles = (amount) => {
  if (amount === null || amount === undefined || amount === '') {
    return 'A consultar';
  }
  const numeric = parseFloat(amount);
  if (isNaN(numeric)) return 'A consultar';
  return `S/ ${numeric.toFixed(2)}`;
};

/**
 * Formats names into a single string.
 * @param {string} nombres 
 * @param {string} paterno 
 * @param {string} materno 
 * @returns {string}
 */
export const formatFullName = (nombres, paterno, materno) => {
  return `${nombres || ''} ${paterno || ''} ${materno || ''}`.replace(/\s+/g, ' ').trim();
};

/**
 * Checks if an image URL is valid.
 * @param {string} url 
 * @returns {boolean}
 */
export const hasValidImage = (url) => {
  if (url === null || url === undefined) return false;
  const cleanUrl = String(url).trim();
  return cleanUrl !== '' && cleanUrl !== 'null' && cleanUrl !== 'undefined';
};
