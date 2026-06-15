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

export const getFaq = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('landing_faq')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) {
      console.warn('landing_faq table error, returning empty FAQs:', error.message);
      return res.json([]);
    }
    return res.json(data || []);
  } catch (err) {
    console.warn('Error fetching FAQ from DB, returning empty FAQs:', err.message);
    return res.json([]);
  }
};
