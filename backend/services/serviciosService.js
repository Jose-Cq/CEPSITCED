/**
 * Obtiene todos los locales activos.
 * @returns {Promise<Array>}
 */
export const obtenerLocalesActivos = async () => {
  try {
    const res = await fetch('/api/servicios/locales');
    if (!res.ok) throw new Error('Error al obtener locales desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerLocalesActivos:', err.message);
    return [];
  }
};

/**
 * Obtiene servicios de landing filtrados por local.
 * @param {string} [localId] 
 * @returns {Promise<Array>}
 */
export const obtenerServiciosLandingPorLocal = async (localId) => {
  try {
    const url = localId 
      ? `/api/servicios/landing?localId=${localId}`
      : `/api/servicios/landing`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al obtener servicios por local desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerServiciosLandingPorLocal:', err.message);
    return [];
  }
};

/**
 * Obtiene todos los servicios activos.
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerServicios = async () => {
  try {
    const res = await fetch('/api/servicios');
    if (!res.ok) throw new Error('Error al obtener servicios desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerServicios:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Obtiene paquetes para un servicio.
 * @param {string} servicioId 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerPaquetes = async (servicioId) => {
  if (!servicioId) {
    return { success: true, data: [] };
  }
  try {
    const res = await fetch(`/api/servicios/${servicioId}/paquetes`);
    if (!res.ok) throw new Error('Error al obtener paquetes desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerPaquetes:', err.message);
    return { success: false, error: err.message };
  }
};
