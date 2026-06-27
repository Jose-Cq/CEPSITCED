/**
 * Utilidades para manejo de fechas y cálculo de edad en el frontend.
 */

/**
 * Obtiene la fecha actual en formato local 'YYYY-MM-DD'.
 * @returns {string}
 */
export const getTodayDateString = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

/**
 * Verifica si una fecha dada en formato 'YYYY-MM-DD' es futura.
 * @param {string} dateStr - Fecha a verificar.
 * @returns {boolean}
 */
export const isFutureDate = (dateStr) => {
  if (!dateStr) return false;
  const todayStr = getTodayDateString();
  return dateStr > todayStr;
};

/**
 * Calcula la edad exacta en base a la fecha de nacimiento.
 * @param {string|Date} fechaNacimiento - Fecha de nacimiento.
 * @returns {number|null}
 */
export const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  
  if (isNaN(fechaNac.getTime())) return null;
  
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNacimiento = fechaNac.getMonth();
  
  if (mesActual < mesNacimiento || (mesActual === mesNacimiento && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  
  return edad;
};

/**
 * Verifica si una persona es mayor de edad (edad >= 18).
 * @param {string|Date} fechaNacimiento - Fecha de nacimiento.
 * @returns {boolean}
 */
export const esMayorDeEdad = (fechaNacimiento) => {
  const edad = calcularEdad(fechaNacimiento);
  return edad !== null && edad >= 18;
};

/**
 * Verifica si una promoción está vigente en la fecha actual.
 * Sigue la REGLA DE FECHAS ABIERTAS: si promo_fecha_fin es NULL,
 * la promoción es permanente (sin fecha de caducidad).
 * @param {object} rule - Objeto con campos promo_fecha_inicio y promo_fecha_fin.
 * @returns {boolean} - true si está activa, false en caso contrario.
 */
export const isPromoActive = (rule) => {
  if (!rule) return false;
  if (!rule.promo_fecha_inicio) return false;
  const todayStr = getTodayDateString();
  if (todayStr < rule.promo_fecha_inicio) return false;
  if (rule.promo_fecha_fin && todayStr > rule.promo_fecha_fin) return false;
  return true;
};

