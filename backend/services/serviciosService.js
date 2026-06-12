import { supabase } from '../../frontend/src/supabaseClient.js';

/**
 * Fetches all active locals.
 * @returns {Promise<Array>}
 */
export const obtenerLocalesActivos = async () => {
  try {
    const { data, error } = await supabase
      .from('locales')
      .select('id, nombre, direccion, activo')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error in obtenerLocalesActivos:', err.message);
    return [];
  }
};

/**
 * Fetches active services to show on the landing page, filtered optionally by localId.
 * Performs both local_id match and locales_ids array inclusion check.
 * @param {string} [localId] 
 * @returns {Promise<Array>}
 */
export const obtenerServiciosLandingPorLocal = async (localId) => {
  try {
    const { data: servs, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('activo', true)
      .eq('mostrar_landing', true);

    if (error) throw error;
    if (!servs) return [];

    // Filter by localId in memory if localId is provided
    let filtered = servs;
    if (localId) {
      filtered = servs.filter(s => {
        const matchesDirect = s.local_id === localId;
        const matchesArray = Array.isArray(s.locales_ids) && s.locales_ids.includes(localId);
        return matchesDirect || matchesArray;
      });
    }

    // Sort by order/name
    return filtered.sort((a, b) => {
      if (a.orden !== null && a.orden !== undefined && b.orden !== null && b.orden !== undefined) {
        return a.orden - b.orden;
      }
      if (a.orden !== null && a.orden !== undefined) return -1;
      if (b.orden !== null && b.orden !== undefined) return 1;
      return (a.nombre_servicio || '').localeCompare(b.nombre_servicio || '');
    });
  } catch (err) {
    console.error('Error in obtenerServiciosLandingPorLocal:', err.message);
    return [];
  }
};

/**
 * Fetches all active services. Used in scheduling.
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerServicios = async () => {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('activo', true);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Fetches all active packages for a given service.
 * @param {string} servicioId 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerPaquetes = async (servicioId) => {
  if (!servicioId) {
    console.warn('obtenerPaquetes llamado sin servicioId válido.');
    return { success: true, data: [] };
  }
  try {
    const { data, error } = await supabase
      .from('paquetes_catalogo')
      .select('*')
      .eq('servicio_id', servicioId)
      .eq('activo', true);

    if (error) {
      console.error('Error Supabase en obtenerPaquetes:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
