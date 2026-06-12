const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Obtiene los especialistas de la landing agregados dinámicamente.
 * @returns {Promise<Array>}
 */
export const obtenerEspecialistasLanding = async () => {
  try {
    const res = await fetch(`${API_URL}/api/especialistas/landing`);
    if (!res.ok) throw new Error('Error al obtener especialistas de la landing desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerEspecialistasLanding:', err.message);
    return [];
  }
};
