/**
 * Input validators and cleaners.
 */

/**
 * Validates a DNI (must be exactly 8 digits).
 * @param {string} dni 
 * @returns {boolean}
 */
export const isValidDni = (dni) => {
  if (!dni) return false;
  const clean = String(dni).replace(/\D/g, '');
  return clean.length === 8;
};

/**
 * Cleans DNI by removing all non-digits.
 * @param {string} dni 
 * @returns {string}
 */
export const cleanDni = (dni) => {
  return dni ? String(dni).replace(/\D/g, '') : '';
};

/**
 * Validates an email address.
 * @param {string} email 
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

/**
 * Validates a Peruvian phone number (usually 9 digits, can have code).
 * @param {string} phone 
 * @returns {boolean}
 */
export const isValidPhone = (phone) => {
  if (!phone) return false;
  const clean = String(phone).replace(/\D/g, '');
  // Allows 9 digits (local cell) or 11 digits (with country code 51)
  return clean.length === 9 || (clean.length === 11 && clean.startsWith('51'));
};
