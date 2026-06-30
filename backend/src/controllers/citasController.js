import { supabase } from '../config/supabase.js';
import { sendSolicitudCambioPsicologoEmail } from '../utils/mailer.js';

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
          .filter(c => {
            const estado = (c.estado_cita || '').toLowerCase();
            return estado !== 'cancelado' && estado !== 'ausente';
          })
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

    // --- VALIDACIÓN DE CRUCE DE HORARIOS PARA EL PACIENTE ---
    const { data: overlappingCitas, error: overlapError } = await supabase
      .from('citas')
      .select('id, hora_inicio, hora_fin')
      .eq('paciente_id', citaData.paciente_id)
      .eq('fecha_cita', citaData.fecha_cita)
      .neq('estado_cita', 'Cancelado')
      .neq('estado_cita', 'Cancelada');

    if (overlapError) throw overlapError;

    if (overlappingCitas && overlappingCitas.length > 0) {
      const toMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const propStart = toMinutes(citaData.hora_inicio);
      const propEnd = toMinutes(citaData.hora_fin);

      const hasOverlap = overlappingCitas.some(c => {
        const cStart = toMinutes(c.hora_inicio);
        const cEnd = toMinutes(c.hora_fin);
        return propStart < cEnd && propEnd > cStart;
      });

      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          error: 'Ya tienes una cita agendada para este mismo día y hora. Por favor, selecciona otro horario.'
        });
      }
    }

    // --- LÓGICA DE CONTROL DE CAMBIO DE PSICÓLOGO CON ORDENACIÓN CRONOLÓGICA REAL ---
    // Consultar todas las citas existentes no canceladas para este paciente y servicio
    const { data: existingCitas, error: historyError } = await supabase
      .from('citas')
      .select('id, psicologo_id, psicologa_nombre, fecha_cita, hora_inicio, estado_cita')
      .eq('paciente_id', citaData.paciente_id)
      .eq('servicio', citaData.servicio)
      .neq('estado_cita', 'Cancelado')
      .neq('estado_cita', 'Cancelada');

    if (historyError) throw historyError;

    // Ordenar de forma ascendente
    const sortedCitas = (existingCitas || []).sort((a, b) => {
      const dateCmp = String(a.fecha_cita).localeCompare(String(b.fecha_cita));
      if (dateCmp !== 0) return dateCmp;
      return String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''));
    });

    // Cita temporal para inserción virtual
    const tempCitaId = 'temp-cita-new-' + Date.now();
    const tempCita = {
      id: tempCitaId,
      psicologo_id: citaData.psicologo_id,
      psicologa_nombre: citaData.psicologa_nombre,
      fecha_cita: citaData.fecha_cita,
      hora_inicio: citaData.hora_inicio
    };

    // Insertar la nueva cita en el orden correcto
    const insertIndex = sortedCitas.findIndex(c => {
      const dateCmp = String(c.fecha_cita).localeCompare(String(tempCita.fecha_cita));
      if (dateCmp > 0) return true;
      if (dateCmp === 0) {
        return String(c.hora_inicio || '').localeCompare(String(tempCita.hora_inicio || '')) > 0;
      }
      return false;
    });

    if (insertIndex === -1) {
      sortedCitas.push(tempCita);
    } else {
      sortedCitas.splice(insertIndex, 0, tempCita);
    }

    // Ubicar la posición de la nueva cita en el historial ordenado
    const idx = sortedCitas.findIndex(c => c.id === tempCitaId);

    let isSpecialistChange = false;
    let psicologoAnteriorId = null;
    let psicologoAnteriorNombre = '';
    let totalUniqueCount = 1;

    if (idx > 0) {
      // Hay citas anteriores cronológicamente
      const immediateAnterior = sortedCitas[idx - 1];
      psicologoAnteriorId = immediateAnterior.psicologo_id;
      psicologoAnteriorNombre = immediateAnterior.psicologa_nombre;

      if (citaData.psicologo_id !== immediateAnterior.psicologo_id) {
        isSpecialistChange = true;
      }

      // Obtener el conjunto de psicólogos únicos previos a esta cita
      const priorCitas = sortedCitas.slice(0, idx);
      const uniquePriorPsicologos = new Set(priorCitas.map(c => c.psicologo_id).filter(Boolean));
      
      // Sumar el especialista actual si no está en la historia previa
      totalUniqueCount = uniquePriorPsicologos.has(citaData.psicologo_id) 
        ? uniquePriorPsicologos.size 
        : uniquePriorPsicologos.size + 1;
    }

    if (isSpecialistChange) {
      if (totalUniqueCount >= 4) {
        if (!citaData.justificacion_cambio_solicitud || !citaData.justificacion_cambio_solicitud.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Has superado el límite de cambios de especialista para este servicio. Debes ingresar un motivo obligatorio para enviar tu solicitud de aprobación.'
          });
        }
        // Marcar la cita como pendiente
        citaData.estado_cita = 'Pendiente';
      }
    }

    // --- Block: one pending/unpaid session per service at a time ---
    const { data: pendingCita, error: pendingError } = await supabase
      .from('citas')
      .select('id')
      .eq('paciente_id', citaData.paciente_id)
      .eq('servicio', citaData.servicio)
      .neq('estado_cita', 'Cancelado')
      .neq('estado_cita', 'Cancelada')
      .neq('estado_pago', 'Rechazado')
      .or('estado_cita.eq.Pendiente,estado_pago.eq.Pendiente')
      .limit(1);

    if (pendingError) throw pendingError;

    if (pendingCita && pendingCita.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya cuentas con una sesión pendiente para este servicio. Para agendar la siguiente sesión, debes concluir tu cita anterior.'
      });
    }

    // Calcular el número estático de sesión del paciente
    const { count: existingCount, error: sesError } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('paciente_id', citaData.paciente_id)
      .eq('servicio', citaData.servicio)
      .not('estado_cita', 'in', '("Cancelado","Ausente")');

    if (sesError) throw sesError;

    citaData.numero_sesion = (existingCount || 0) + 1;

    const { justificacion_cambio_solicitud, ...insertData } = citaData;

    const { data, error } = await supabase
      .from('citas')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;

    // Si fue un cambio bloqueado, registrar la solicitud en `cambio_psicologo` y notificar por correo
    if (isSpecialistChange && totalUniqueCount >= 4) {
      try {
        const { error: reqError } = await supabase
          .from('cambio_psicologo')
          .insert([{
            cita_id: data.id,
            paciente_id: citaData.paciente_id,
            servicio: citaData.servicio,
            psicologo_anterior_id: psicologoAnteriorId,
            psicologo_nuevo_id: citaData.psicologo_id,
            motivo: justificacion_cambio_solicitud,
            estado: 'Pendiente'
          }]);
        if (reqError) {
          console.error('Error al insertar en cambio_psicologo:', reqError.message);
        }

        // Obtener datos del paciente
        const { data: pacienteInfo } = await supabase
          .from('pacientes')
          .select('nombres, apellido_paterno, apellido_materno, dni')
          .eq('id_paciente', citaData.paciente_id)
          .single();

        if (pacienteInfo) {
          const nombresPaciente = `${pacienteInfo.nombres || ''} ${pacienteInfo.apellido_paterno || ''} ${pacienteInfo.apellido_materno || ''}`.trim();
          await sendSolicitudCambioPsicologoEmail({
            nombresPaciente,
            dniPaciente: pacienteInfo.dni,
            servicio: citaData.servicio,
            psicologoAnterior: psicologoAnteriorNombre,
            psicologoNuevo: citaData.psicologa_nombre,
            motivo: justificacion_cambio_solicitud
          });
        }
      } catch (mailErr) {
        console.error('Error al procesar notificación de cambio:', mailErr.message);
      }
    }

    // Decrement credit if this cita uses an acquired package
    if (citaData.paquete_id) {
      const { data: packData, error: packFetchError } = await supabase
        .from('paquetes_adquiridos')
        .select('sesiones_disponibles')
        .eq('id', citaData.paquete_id)
        .single();

      if (!packFetchError && packData) {
        const newCount = Math.max(0, (packData.sesiones_disponibles || 0) - 1);
        const { error: packUpdateError } = await supabase
          .from('paquetes_adquiridos')
          .update({ sesiones_disponibles: newCount })
          .eq('id', citaData.paquete_id);
        if (packUpdateError) {
          console.error('Error al descontar crédito del paquete:', packUpdateError.message);
        }
      } else if (packFetchError) {
        console.error('Error al leer crédito del paquete:', packFetchError.message);
      }
    }

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
      .neq('estado_cita', 'Cancelado');

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
      .neq('estado_cita', 'Cancelado');

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
      .update({ estado_cita: 'Cancelado', estado_pago: 'Rechazado' })
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
