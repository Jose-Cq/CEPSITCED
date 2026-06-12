import { supabase } from '../../frontend/src/supabaseClient.js';

/**
 * Fetches all appointments for a given patient.
 * @param {string} pacienteId 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerCitasPaciente = async (pacienteId) => {
  if (!pacienteId) {
    console.warn('obtenerCitasPaciente llamado sin pacienteId válido.');
    return { success: true, data: [] };
  }
  try {
    const { data, error } = await supabase
      .from('citas')
      .select('*, habitaciones(nombre, locales(nombre, direccion))')
      .eq('paciente_id', pacienteId)
      .order('fecha_cita', { ascending: false });

    if (error) {
      console.error('Error Supabase en obtenerCitasPaciente:', {
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

/**
 * Creates a new appointment.
 * @param {Object} citaData 
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const crearCita = async (citaData) => {
  try {
    const { data, error } = await supabase
      .from('citas')
      .insert([citaData])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Fetches appointments for a specific day.
 * @param {string} fecha 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerCitasDelDia = async (fecha) => {
  try {
    const { data, error } = await supabase
      .from('citas')
      .select('psicologa_nombre, hora_inicio, hora_fin')
      .eq('fecha_cita', fecha)
      .neq('estado_cita', 'cancelada');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Fetches specialists/employees associated with a given service.
 * @param {string} servicioId 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerPsicologasPorServicio = async (servicioId) => {
  if (!servicioId) {
    console.warn('obtenerPsicologasPorServicio llamado sin servicioId válido.');
    return { success: true, data: [] };
  }
  try {
    const { data: psRelations, error: relError } = await supabase
      .from('psicologo_servicio')
      .select('psicologo_id')
      .eq('servicio_id', servicioId);

    if (relError) {
      console.error('Error Supabase en obtenerPsicologasPorServicio (relaciones):', {
        message: relError.message,
        details: relError.details,
        hint: relError.hint,
        code: relError.code
      });
      throw relError;
    }
    if (!psRelations || psRelations.length === 0) return { success: true, data: [] };

    const psicologoIds = psRelations.map(r => r.psicologo_id);

    const { data: employees, error: empError } = await supabase
      .from('empleados')
      .select('*')
      .in('id', psicologoIds)
      .eq('activo', true);

    if (empError) {
      console.error('Error Supabase en obtenerPsicologasPorServicio (empleados):', {
        message: empError.message,
        details: empError.details,
        hint: empError.hint,
        code: empError.code
      });
      throw empError;
    }

    const mappedData = employees ? employees.map(emp => ({
      ...emp,
      nombres_apellidos: `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
    })) : [];

    return { success: true, data: mappedData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Fetches employee schedules based on therapist, date and modality.
 * @param {string} psicologoId 
 * @param {string} fecha 
 * @param {string} modality 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerHorariosPsicologas = async (psicologoId, fecha, modalidad) => {
  if (!psicologoId) {
    console.warn('obtenerHorariosPsicologas llamado sin psicologoId válido.');
    return { success: true, data: [] };
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
      query = query.eq('modalidad', modalidad);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error Supabase en obtenerHorariosPsicologas:', {
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

/**
 * Fetches non-canceled appointments for a specific therapist on a date.
 * @param {string} psicologoId 
 * @param {string} fecha 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerCitasPsicologa = async (psicologoId, fecha) => {
  if (!psicologoId) {
    console.warn('obtenerCitasPsicologa llamado sin psicologoId válido.');
    return { success: true, data: [] };
  }
  try {
    const { data, error } = await supabase
      .from('citas')
      .select('*')
      .eq('psicologo_id', psicologoId)
      .eq('fecha_cita', fecha)
      .neq('estado_cita', 'cancelada');

    if (error) {
      console.error('Error Supabase en obtenerCitasPsicologa:', {
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

/**
 * Fetches active rooms by local.
 * @param {string} localId 
 * @returns {Promise<Array|null>}
 */
export const obtenerHabitacionesPorLocal = async (localId) => {
  if (!localId) {
    console.warn('obtenerHabitacionesPorLocal llamado sin localId válido.');
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('habitaciones')
      .select('id, nombre, local_id, activo')
      .eq('local_id', localId)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error Supabase en obtenerHabitacionesPorLocal:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Error loading rooms by local:', err.message);
    return null;
  }
};

/**
 * Cancels a specific appointment.
 * @param {string} citaId 
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const cancelarCita = async (citaId) => {
  if (!citaId) {
    console.warn('cancelarCita llamado sin citaId válido.');
    return { success: false, error: 'ID de cita no proporcionado.' };
  }
  try {
    const { data, error } = await supabase
      .from('citas')
      .update({ estado_cita: 'Cancelada' })
      .eq('id', citaId)
      .select()
      .single();

    if (error) {
      console.error('Error Supabase en cancelarCita:', {
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
