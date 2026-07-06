/**
 * Input validators and cleaners.
 */

/**
 * Cleans DNI by removing all non-digits.
 * @param {string} dni
 * @returns {string}
 */
export const cleanDni = (dni) => {
  return dni ? String(dni).replace(/\D/g, '') : '';
};
