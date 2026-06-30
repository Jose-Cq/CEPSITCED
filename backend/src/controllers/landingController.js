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

export const getMisionVision = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('landing_nosotros')
      .select('mision_subtitulo, mision_texto, vision_subtitulo, vision_texto, imagen_url, creado_at, updated_at')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return res.json(data || null);
  } catch (err) {
    console.error('Error en getMisionVision:', err.message);
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

export const updateConfiguracion = async (req, res) => {
  try {
    const { id, mostrar_nosotros, mostrar_personal, mostrar_testimonios, mostrar_faq } = req.body;
    
    let targetId = id;
    if (!targetId) {
      const { data: firstRow } = await supabase
        .from('landing_configuracion')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (firstRow) {
        targetId = firstRow.id;
      }
    }

    if (!targetId) {
      return res.status(404).json({ error: 'No se encontró un registro de configuración para actualizar.' });
    }

    const { data, error } = await supabase
      .from('landing_configuracion')
      .update({
        mostrar_nosotros,
        mostrar_personal,
        mostrar_testimonios,
        mostrar_faq,
        updated_at: new Date()
      })
      .eq('id', targetId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error en updateConfiguracion:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const updateNosotros = async (req, res) => {
  try {
    const { id, mision_subtitulo, mision_texto, vision_subtitulo, vision_texto, imagen_url } = req.body;
    
    let targetId = id;
    if (!targetId) {
      const { data: firstRow } = await supabase
        .from('landing_nosotros')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (firstRow) {
        targetId = firstRow.id;
      }
    }

    if (!targetId) {
      return res.status(404).json({ error: 'No se encontró un registro de Nosotros para actualizar.' });
    }

    const { data, error } = await supabase
      .from('landing_nosotros')
      .update({
        mision_subtitulo,
        mision_texto,
        vision_subtitulo,
        vision_texto,
        imagen_url,
        updated_at: new Date()
      })
      .eq('id', targetId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error en updateNosotros:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
