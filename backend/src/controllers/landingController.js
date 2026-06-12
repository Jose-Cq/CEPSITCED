import { supabase } from '../config/supabase.js';

export const getCarrusel = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('landing_carousel')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error en getCarrusel:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const getConfiguracion = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('landing_configuracion')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return res.json(data || null);
  } catch (err) {
    console.error('Error en getConfiguracion:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const getTestimonios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('landing_testimonios')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error en getTestimonios:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
