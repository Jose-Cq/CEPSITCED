/**
 * Centraliza la lógica de formateo de textos en el frontend.
 */

/**
 * Convierte un texto a Title Case (capitalización de cada palabra).
 * - Elimina cualquier número del texto.
 * - Respeta letras acentuadas (tildes) y la 'ñ' / 'Ñ'.
 * - Capitaliza correctamente nombres compuestos y separados por guiones.
 * - Evita capitalizaciones incorrectas intermedias (ej. "CéSar" -> "César").
 * 
 * @param {string} value - Texto a formatear.
 * @returns {string} - Texto formateado.
 */
export const toTitleCase = (value) => {
  if (!value) return '';
  
  // 1. Eliminar números
  const withoutNumbers = String(value).replace(/[0-9]/g, '');
  
  // 2. Normalizar a minúsculas y capitalizar palabras iniciales
  return withoutNumbers
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s\-])\p{L}/gu, char => char.toUpperCase());
};
