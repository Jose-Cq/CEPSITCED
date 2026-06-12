import { supabase } from '../../frontend/src/supabaseClient.js';

/**
 * Fetches active slides for the landing carousel, ordered by "orden".
 * Handles loading/error fallback by returning empty array.
 * @returns {Promise<Array>}
 */
export const obtenerCarruselLanding = async () => {
  try {
    const { data, error } = await supabase
      .from('landing_carousel')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error in obtenerCarruselLanding:', err.message);
    return [];
  }
};

/**
 * Fetches the landing configuration (mision, vision, mostrar_nosotros).
 * @returns {Promise<Object|null>}
 */
export const obtenerConfiguracionLanding = async () => {
  try {
    const { data, error } = await supabase
      .from('landing_configuracion')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error('Error in obtenerConfiguracionLanding:', err.message);
    return null;
  }
};

/**
 * Fetches active testimonials, ordered by "orden".
 * @returns {Promise<Array>}
 */
export const obtenerTestimoniosLanding = async () => {
  try {
    const { data, error } = await supabase
      .from('landing_testimonios')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error in obtenerTestimoniosLanding:', err.message);
    return [];
  }
};
