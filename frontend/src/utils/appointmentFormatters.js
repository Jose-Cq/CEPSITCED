/**
 * Formatea una fecha numérica (año, mes, día) a formato de cadena YYYY-MM-DD.
 * @param {number} year - Año.
 * @param {number} month - Mes (0-11).
 * @param {number} day - Día del mes.
 * @returns {string} - Cadena de fecha YYYY-MM-DD.
 */
export const formatDateStr = (year, month, day) => {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

/**
 * Formatea un número de teléfono agregando espacios para legibilidad si tiene 9 dígitos.
 * @param {string|number} val - Número a formatear.
 * @returns {string} - Número formateado.
 */
export const formatPhoneNumber = (val) => {
  if (!val) return '';
  const clean = String(val).replace(/\s+/g, '');
  if (clean.length === 9) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return val;
};

