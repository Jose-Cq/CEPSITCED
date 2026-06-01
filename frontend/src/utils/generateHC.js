/**
 * Genera el número de Historia Clínica según el formato:
 * XXXX + DD + MM + AA + (M/F mayúscula si es mayor de edad, m/f minúscula si es menor)
 * 
 * Ejemplo: 0001020526M
 * - 0001: Número secuencial (4 dígitos)
 * - 02: Día de registro
 * - 05: Mes de registro
 * - 26: Año de registro
 * - M: Mayor de edad masculino
 */

export const generarNumeroHC = (fechaNacimiento, genero, ultimoHC = null) => {
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  
  // Calcular edad
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNacimiento = fechaNac.getMonth();
  if (mesActual < mesNacimiento || (mesActual === mesNacimiento && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  const esMayorDeEdad = edad >= 18;

  // Día de registro
  const dia = String(hoy.getDate()).padStart(2, '0');
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const año = String(hoy.getFullYear()).slice(-2);

  // Extraer el número secuencial del último HC (si existe)
  let nuevoSecuencial = 1;
  if (ultimoHC) {
    // El formato es XXXXD DMM AA[X], asumiendo que los primeros 4 caracteres son el secuencial
    const secuencialStr = ultimoHC.substring(0, 4);
    const secuencialNum = parseInt(secuencialStr, 10);
    if (!isNaN(secuencialNum)) {
      nuevoSecuencial = secuencialNum + 1;
    }
  }
  const secuencialFormateado = String(nuevoSecuencial).padStart(4, '0');

  // Letra de género
  let letraGenero;
  if (genero === 'Masculino') {
    letraGenero = esMayorDeEdad ? 'M' : 'm';
  } else {
    letraGenero = esMayorDeEdad ? 'F' : 'f';
  }

  const numeroHC = `${secuencialFormateado}${dia}${mes}${año}${letraGenero}`;
  return { numeroHC, edad, esMayorDeEdad };
};

/**
 * Calcula la edad a partir de la fecha de nacimiento
 */
export const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  
  // Validar que la fecha sea válida
  if (isNaN(fechaNac.getTime())) return null;
  
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNacimiento = fechaNac.getMonth();
  
  // Ajustar si aún no ha cumplido años este año
  if (mesActual < mesNacimiento || (mesActual === mesNacimiento && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  
  return edad;
};

/**
 * Valida si una persona es mayor de edad basado en su fecha de nacimiento
 */
export const esMayorDeEdad = (fechaNacimiento) => {
  const edad = calcularEdad(fechaNacimiento);
  return edad !== null && edad >= 18;
};