import { supabase } from '../../frontend/src/supabaseClient.js';

const getHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
};

/**
 * Obtiene todas las citas de un paciente.
 */
export const obtenerCitasPaciente = async (pacienteId) => {
  if (!pacienteId) {
    return { success: true, data: [] };
  }
  try {
    const headers = await getHeaders();
    const res = await fetch(`/api/citas/paciente/${pacienteId}`, {
      headers
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al obtener citas del paciente');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en obtenerCitasPaciente:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Crea una nueva cita.
 */
export const crearCita = async (citaData) => {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/citas', {
      method: 'POST',
      headers,
      body: JSON.stringify(citaData)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al crear la cita');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en crearCita:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene las citas registradas en un día específico.
 */
export const obtenerCitasDelDia = async (fecha) => {
  try {
    const res = await fetch(`/api/citas/dia?fecha=${fecha}`);
    if (!res.ok) throw new Error('Error al obtener citas del día');
    return await res.json();
  } catch (error) {
    console.error('Error en obtenerCitasDelDia:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene las psicólogas activas asociadas a un servicio.
 */
export const obtenerPsicologasPorServicio = async (servicioId) => {
  if (!servicioId) {
    return { success: true, data: [] };
  }
  try {
    const res = await fetch(`/api/citas/psicologas-servicio/${servicioId}`);
    if (!res.ok) throw new Error('Error al obtener psicólogas por servicio');
    return await res.json();
  } catch (error) {
    console.error('Error en obtenerPsicologasPorServicio:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene los horarios programados de una psicóloga en una fecha y modalidad dadas.
 */
export const obtenerHorariosPsicologas = async (psicologoId, fecha, modalidad) => {
  if (!psicologoId) {
    return { success: true, data: [] };
  }
  try {
    let queryParams = `psicologoId=${psicologoId}`;
    if (fecha) queryParams += `&fecha=${fecha}`;
    if (modalidad) queryParams += `&modalidad=${modalidad}`;

    const res = await fetch(`/api/citas/horarios-psicologas?${queryParams}`);
    if (!res.ok) throw new Error('Error al obtener horarios de psicólogas');
    return await res.json();
  } catch (error) {
    console.error('Error en obtenerHorariosPsicologas:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene las citas de una psicóloga en una fecha específica.
 */
export const obtenerCitasPsicologa = async (psicologoId, fecha) => {
  if (!psicologoId || !fecha) {
    return { success: true, data: [] };
  }
  try {
    const res = await fetch(`/api/citas/citas-psicologa?psicologoId=${psicologoId}&fecha=${fecha}`);
    if (!res.ok) throw new Error('Error al obtener citas de psicóloga');
    return await res.json();
  } catch (error) {
    console.error('Error en obtenerCitasPsicologa:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene las habitaciones activas de un local.
 */
export const obtenerHabitacionesPorLocal = async (localId) => {
  if (!localId) {
    return [];
  }
  try {
    const res = await fetch(`/api/citas/habitaciones/${localId}`);
    if (!res.ok) throw new Error('Error al obtener habitaciones por local');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerHabitacionesPorLocal:', err.message);
    return null;
  }
};

/**
 * Cancela una cita específica por su ID.
 */
export const cancelarCita = async (citaId) => {
  if (!citaId) {
    return { success: false, error: 'ID de cita no proporcionado.' };
  }
  try {
    const headers = await getHeaders();
    const res = await fetch(`/api/citas/${citaId}/cancelar`, {
      method: 'PUT',
      headers
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al cancelar la cita');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en cancelarCita:', error.message);
    return { success: false, error: error.message };
  }
};
