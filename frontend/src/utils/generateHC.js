/**
 * Calculates the age based on a birth date.
 * @param {string|Date} fechaNacimiento
 * @returns {number|null}
 */
export const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  
  // Validate date
  if (isNaN(fechaNac.getTime())) return null;
  
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNacimiento = fechaNac.getMonth();
  
  // Adjust if birthday hasn't occurred yet this year
  if (mesActual < mesNacimiento || (mesActual === mesNacimiento && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  
  return edad;
};

/**
 * Validates if a person is of legal age (>= 18) based on birth date.
 * @param {string|Date} fechaNacimiento
 * @returns {boolean}
 */
export const esMayorDeEdad = (fechaNacimiento) => {
  const edad = calcularEdad(fechaNacimiento);
  return edad !== null && edad >= 18;
};