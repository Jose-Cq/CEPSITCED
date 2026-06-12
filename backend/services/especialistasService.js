/**
 * Obtiene los especialistas de la landing agregados dinámicamente.
 * @returns {Promise<Array>}
 */
export const obtenerEspecialistasLanding = async () => {
  try {
    const res = await fetch('/api/especialistas/landing');
    if (!res.ok) throw new Error('Error al obtener especialistas de la landing desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerEspecialistasLanding:', err.message);
    return [];
  }
};
