/**
 * Expresiones y funciones de validación comunes en el frontend.
 */

/**
 * Limpia un número de documento eliminando caracteres no numéricos.
 * @param {string} doc - Documento a limpiar.
 * @returns {string} - Documento limpio (solo dígitos).
 */
export const cleanDocument = (doc) => {
  if (!doc) return '';
  return String(doc).replace(/\D/g, '');
};

/**
 * Valida si el formato de correo electrónico es correcto.
 * @param {string} email - Correo a validar.
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

/**
 * Valida si un DNI de Perú es correcto (debe tener exactamente 8 dígitos numéricos).
 * @param {string} dni - DNI a validar.
 * @returns {boolean}
 */
export const isValidDni = (dni) => {
  const cleaned = cleanDocument(dni);
  return cleaned.length === 8;
};

/**
 * Valida si un Carnet de Extranjería u otro documento extranjero es correcto (entre 8 y 12 dígitos numéricos).
 * @param {string} ce - CE a validar.
 * @returns {boolean}
 */
export const isValidCE = (ce) => {
  const cleaned = cleanDocument(ce);
  return cleaned.length >= 8 && cleaned.length <= 12;
};

/**
 * Valida un documento según el tipo especificado.
 * @param {string} doc - Documento a validar.
 * @param {string} tipo - Tipo de documento ('DNI' o otro).
 * @returns {boolean}
 */
export const isValidDocument = (doc, tipo) => {
  if (tipo === 'DNI') {
    return isValidDni(doc);
  }
  return isValidCE(doc);
};

/**
 * Valida si los datos críticos de un perfil de paciente están incompletos.
 * @param {object} profile - El perfil a validar.
 * @returns {boolean} - true si está incompleto, false si está completo.
 */
export const isProfileIncomplete = (profile) => {
  if (!profile) return true;
  if (!profile.genero || !profile.direccion || !profile.pais) return true;
  if (profile.pais === 'Perú') {
    if (!profile.departamento || !profile.provincia || !profile.distrito) return true;
  }
  return false;
};

