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



