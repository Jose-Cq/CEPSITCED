import { supabase } from '../config/supabase.js';

// Auxiliar para validar que el paciente pertenece al usuario o es su dependiente
const verificarPertenenciaPaciente = async (pacienteId, userId) => {
  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('id_perfil_propio, id_apoderado')
    .eq('id_paciente', pacienteId)
    .maybeSingle();

  if (error || !paciente) return false;
  return paciente.id_perfil_propio === userId || paciente.id_apoderado === userId;
};

// Auxiliar para validar que la cita pertenece a un paciente del usuario
const verificarPertenenciaCita = async (citaId, userId) => {
  const { data: cita, error } = await supabase
    .from('citas')
    .select('paciente_id')
    .eq('id', citaId)
    .maybeSingle();

  if (error || !cita) return false;
  return verificarPertenenciaPaciente(cita.paciente_id, userId);
};

export const getCitasPaciente = async (req, res) => {
  const { pacienteId } = req.params;
  if (!pacienteId) {
    return res.status(400).json({ success: false, error: 'ID de paciente no proporcionado.' });
  }

  try {
    const tieneAcceso = await verificarPertenenciaPaciente(pacienteId, req.user.id);
    if (!tieneAcceso) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para ver las citas de este paciente.' });
    }

    const { data, error } = await supabase
      .from('citas')
      .select('*, habitaciones(nombre, locales(nombre, direccion))')
      .eq('paciente_id', pacienteId)
      .order('fecha_cita', { ascending: false });

    if (error) throw error;

    // Dynamic session numbering by chronological order per (paciente, servicio)
    if (data && data.length > 0) {
      // Group citas by servicio
      const byServicio = {};
      for (const cita of data) {
        if (!byServicio[cita.servicio]) byServicio[cita.servicio] = [];
        byServicio[cita.servicio].push(cita);
      }
      // Compute rank for each cita within its servicio
      const sessionMap = {};
      for (const servicio of Object.keys(byServicio)) {
        const validCitas = byServicio[servicio]
          .filter(c => c.estado_cita !== 'Cancelada' && c.estado_cita !== 'Ausente')
          .sort((a, b) => {
            const dateCmp = String(a.fecha_cita).localeCompare(String(b.fecha_cita));
            if (dateCmp !== 0) return dateCmp;
            return String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''));
          });
        validCitas.forEach((cita, idx) => {
          sessionMap[cita.id] = idx + 1;
        });
      }
      for (const cita of data) {
        cita.numero_sesion = sessionMap[cita.id] || null;
      }

      // Look up coupon info for each cita
      const citaIds = data.map(c => c.id);
      const { data: cuponUsos, error: cuponError } = await supabase
        .from('cupones_usos')
        .select('cita_id, cupones!inner(codigo, tipo_descuento, valor_descuento)')
        .in('cita_id', citaIds);

      if (!cuponError && cuponUsos) {
        const cuponMap = {};
        for (const uso of cuponUsos) {
          cuponMap[uso.cita_id] = uso.cupones;
        }
        for (const cita of data) {
          cita.cupon_aplicado = cuponMap[cita.id] || null;
        }
      }
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getCitasPaciente:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const postCrearCita = async (req, res) => {
  const citaData = req.body;
  if (!citaData.paciente_id) {
    return res.status(400).json({ success: false, error: 'El ID de paciente es obligatorio.' });
  }

  try {
    const tieneAcceso = await verificarPertenenciaPaciente(citaData.paciente_id, req.user.id);
    if (!tieneAcceso) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para crear citas para este paciente.' });
    }

    // --- Block: one pending cita per service at a time ---
    // If the patient already has a cita with estado_cita = 'Pendiente' or
    // estado_pago = 'Pendiente' for this service, block new bookings.
    const { data: pendingCita, error: pendingError } = await supabase
      .from('citas')
      .select('id')
      .eq('paciente_id', citaData.paciente_id)
      .eq('servicio', citaData.servicio)
      .or('estado_cita.eq.Pendiente,estado_pago.eq.Pendiente')
      .limit(1);

    if (pendingError) throw pendingError;

    if (pendingCita && pendingCita.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya cuentas con una sesión pendiente para este servicio. Para agendar la siguiente sesión, debes concluir tu cita anterior.'
      });
    }

    // Compute next session number: count valid citas by chronological order
    // (excluding Cancelada and Ausente); the next session is count + 1
    const { count: existingCount, error: sesError } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('paciente_id', citaData.paciente_id)
      .eq('servicio', citaData.servicio)
      .not('estado_cita', 'in', '("Cancelada","Ausente")');

    if (sesError) throw sesError;

    citaData.numero_sesion = (existingCount || 0) + 1;

    const { data, error } = await supabase
      .from('citas')
      .insert([citaData])
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en postCrearCita:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getCitasDelDia = async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) {
    return res.status(400).json({ success: false, error: 'La fecha es obligatoria.' });
  }

  try {
    const { data, error } = await supabase
      .from('citas')
      .select('psicologa_nombre, hora_inicio, hora_fin')
      .eq('fecha_cita', fecha)
      .neq('estado_cita', 'cancelada');

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getCitasDelDia:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getPsicologasPorServicio = async (req, res) => {
  const { servicioId } = req.params;
  if (!servicioId) {
    return res.status(400).json({ success: false, error: 'ID de servicio es requerido.' });
  }

  try {
    const { data: psRelations, error: relError } = await supabase
      .from('psicologo_servicio')
      .select('psicologo_id')
      .eq('servicio_id', servicioId);

    if (relError) throw relError;
    if (!psRelations || psRelations.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const psicologoIds = psRelations.map(r => r.psicologo_id);

    const { data: employees, error: empError } = await supabase
      .from('empleados')
      .select('*')
      .in('id', psicologoIds)
      .eq('activo', true);

    if (empError) throw empError;

    const mappedData = employees ? employees
      .filter(emp => emp.ofrece_servicios !== false)
      .map(emp => ({
        ...emp,
        nombres_apellidos: `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
      })) : [];

    return res.json({ success: true, data: mappedData });
  } catch (error) {
    console.error('Error en getPsicologasPorServicio:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getHorariosPsicologas = async (req, res) => {
  const { psicologoId, fecha, modalidad } = req.query;
  if (!psicologoId) {
    return res.status(400).json({ success: false, error: 'ID de psicóloga es requerido.' });
  }

  try {
    let query = supabase
      .from('horarios_empleados')
      .select('*')
      .eq('empleado_id', psicologoId);

    if (fecha) {
      query = query.eq('fecha', fecha);
    }

    if (modalidad) {
      if (modalidad === 'Presencial') {
        query = query.eq('modalidad', 'Presencial');
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getHorariosPsicologas:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getCitasPsicologa = async (req, res) => {
  const { psicologoId, fecha } = req.query;
  if (!psicologoId || !fecha) {
    return res.status(400).json({ success: false, error: 'ID de psicóloga y fecha son obligatorios.' });
  }

  try {
    const { data, error } = await supabase
      .from('citas')
      .select('*')
      .eq('psicologo_id', psicologoId)
      .eq('fecha_cita', fecha)
      .neq('estado_cita', 'cancelada');

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getCitasPsicologa:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getHabitacionesPorLocal = async (req, res) => {
  const { localId } = req.params;
  if (!localId) {
    return res.status(400).json({ success: false, error: 'ID de local es obligatorio.' });
  }

  try {
    const { data, error } = await supabase
      .from('habitaciones')
      .select('id, nombre, local_id, activo')
      .eq('local_id', localId)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error en getHabitacionesPorLocal:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const putCancelarCita = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID de cita no proporcionado.' });
  }

  try {
    const tieneAcceso = await verificarPertenenciaCita(id, req.user.id);
    if (!tieneAcceso) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para cancelar esta cita.' });
    }

    const { data, error } = await supabase
      .from('citas')
      .update({ estado_cita: 'Cancelada' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en putCancelarCita:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
