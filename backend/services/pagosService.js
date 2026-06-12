import { supabase } from '../../frontend/src/supabaseClient.js';

/**
 * Fetches all active payment methods of the clinic.
 * @returns {Promise<Array|null>}
 */
export const obtenerMetodosPagoClinica = async () => {
  try {
    const { data, error } = await supabase
      .from('metodos_pago_clinica')
      .select('*')
      .eq('activo', true)
      .order('tipo', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading clinic payment methods:', error);
    return null;
  }
};
