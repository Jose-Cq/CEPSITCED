import { supabase } from '../config/supabase.js';

export const getLocalesActivos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('locales')
      .select('id, nombre, direccion, activo')
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error en getLocalesActivos:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const getServiciosLandingPorLocal = async (req, res) => {
  const { localId } = req.query;
  try {
    const { data: servs, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('activo', true)
      .eq('mostrar_landing', true);

    if (error) throw error;
    if (!servs) return res.json([]);

    let filtered = servs;
    if (localId) {
      filtered = servs.filter(s => {
        const matchesDirect = s.local_id === localId;
        const matchesArray = Array.isArray(s.locales_ids) && s.locales_ids.includes(localId);
        return matchesDirect || matchesArray;
      });
    }

    filtered.sort((a, b) => {
      if (a.orden !== null && a.orden !== undefined && b.orden !== null && b.orden !== undefined) {
        return a.orden - b.orden;
      }
      if (a.orden !== null && a.orden !== undefined) return -1;
      if (b.orden !== null && b.orden !== undefined) return 1;
      return (a.nombre_servicio || '').localeCompare(b.nombre_servicio || '');
    });

    return res.json(filtered);
  } catch (err) {
    console.error('Error en getServiciosLandingPorLocal:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const getServicios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('activo', true);

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error en getServicios:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getPaquetes = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.json({ success: true, data: [] });
  }
  try {
    const { data, error } = await supabase
      .from('paquetes_catalogo')
      .select('*')
      .eq('servicio_id', id)
      .eq('activo', true);

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error en getPaquetes:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getReglasPrecios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reglas_precios')
      .select('*');

    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Error en getReglasPrecios:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getCuponByCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res.status(400).json({ success: false, error: 'Código de cupón no proporcionado.' });
    }
    const { data, error } = await supabase
      .from('cupones')
      .select('*')
      .ilike('codigo', codigo.trim())
      .eq('activo', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: 'Cupón inválido o inactivo.' });
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error en getCuponByCodigo:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const usarCupon = async (req, res) => {
  try {
    const { cuponId, pacienteId, citaId, paqueteAdquiridoId } = req.body;
    if (!cuponId || !pacienteId) {
      return res.status(400).json({ success: false, error: 'Faltan datos requeridos.' });
    }

    // 1. Registrar uso del cupón
    const { error: usageErr } = await supabase
      .from('cupones_usos')
      .insert([{
        cupon_id: cuponId,
        paciente_id: pacienteId,
        cita_id: citaId || null,
        paquete_adquirido_id: paqueteAdquiridoId || null
      }]);

    if (usageErr) throw usageErr;

    // 2. Obtener usos actuales
    const { data: coupon, error: getErr } = await supabase
      .from('cupones')
      .select('cantidad_usos_actual')
      .eq('id', cuponId)
      .single();

    if (getErr) throw getErr;

    // 3. Incrementar usos del cupón
    const { error: updateErr } = await supabase
      .from('cupones')
      .update({ cantidad_usos_actual: (coupon.cantidad_usos_actual || 0) + 1 })
      .eq('id', cuponId);

    if (updateErr) throw updateErr;

    return res.json({ success: true });
  } catch (err) {
    console.error('Error en usarCupon:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
