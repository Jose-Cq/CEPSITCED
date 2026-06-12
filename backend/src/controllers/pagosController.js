import { supabase } from '../config/supabase.js';

export const getMetodosPagoClinica = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('metodos_pago_clinica')
      .select('*')
      .eq('activo', true)
      .order('tipo', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    console.error('Error en getMetodosPagoClinica:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
