import { supabase } from '../../frontend/src/supabaseClient.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
 * Inicia sesión usando DNI y Contraseña a través de la API.
 * Establece la sesión de forma local en el cliente de Supabase tras el éxito.
 */
export const iniciarSesion = async (dni, password) => {
  try {
    const res = await fetch(`${API_URL}/api/pacientes/iniciar-sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, password })
    });
    
    const result = await res.json();
    if (!res.ok || !result.success) {
      return { success: false, error: result.error || 'Error al iniciar sesión.' };
    }

    // Guardar la sesión devuelta por la API en el cliente de Supabase local para mantener el estado
    const { session } = result.data;
    if (session) {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
      if (error) throw error;
    }

    return { success: true, data: result.data };
  } catch (err) {
    console.error('Error en iniciarSesion:', err.message);
    return { success: false, error: err.message || 'Error de conexión.' };
  }
};

/**
 * Cierra la sesión activa en el cliente de Supabase.
 */
export const cerrarSesion = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene el último número de historia clínica desde la API.
 */
export const obtenerUltimoNumeroHC = async () => {
  try {
    const res = await fetch(`${API_URL}/api/pacientes/ultimo-hc`);
    if (!res.ok) throw new Error('Error al obtener el último HC');
    const result = await res.json();
    return result.data || null;
  } catch (error) {
    console.error('Error en obtenerUltimoNumeroHC:', error.message);
    return null;
  }
};

/**
 * Verifica si un DNI está duplicado en la base de datos a través de la API.
 */
export const verificarDuplicadoDNI = async (dni) => {
  try {
    const res = await fetch(`${API_URL}/api/pacientes/verificar-dni?dni=${dni}`);
    if (!res.ok) throw new Error('Error al verificar duplicado de DNI');
    const result = await res.json();
    return { duplicated: !!result.duplicated };
  } catch (error) {
    console.error('Error en verificarDuplicadoDNI:', error.message);
    return { duplicated: false, error: error.message };
  }
};

/**
 * Obtiene el perfil de usuario actual desde la API.
 */
export const obtenerPerfilActual = async () => {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/api/pacientes/perfil/actual`, {
      headers
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al obtener perfil actual');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en obtenerPerfilActual:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Registra un perfil de usuario (tabla perfiles) a través de la API.
 */
export const registrarPerfil = async (perfilData) => {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/api/pacientes/perfil`, {
      method: 'POST',
      headers,
      body: JSON.stringify(perfilData)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al registrar el perfil');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en registrarPerfil:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Registra una nueva ficha clínica de paciente a través de la API.
 */
export const registrarPaciente = async (pacienteData) => {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/api/pacientes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(pacienteData)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al registrar paciente');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en registrarPaciente:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene el registro de paciente del usuario autenticado.
 */
export const obtenerPacienteActual = async () => {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/api/pacientes/actual`, {
      headers
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al obtener paciente actual');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en obtenerPacienteActual:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Actualiza la ficha de un paciente por su ID.
 */
export const actualizarPaciente = async (pacienteId, updateData) => {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/api/pacientes/${pacienteId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al actualizar paciente');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en actualizarPaciente:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene los pacientes asociados (familiares dependientes) del usuario autenticado.
 */
export const obtenerPacientesAsociados = async () => {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/api/pacientes/asociados`, {
      headers
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al obtener asociados');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en obtenerPacientesAsociados:', error.message);
    return { success: false, error: error.message };
  }
};

// Alias para obtenerPacientesAsociados
export const obtenerApoderados = async () => {
  return obtenerPacientesAsociados();
};

/**
 * Obtiene los trámites documentales de un paciente por su ID.
 */
export const obtenerDocumentosPaciente = async (pacienteId) => {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/api/pacientes/${pacienteId}/documentos`, {
      headers
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al obtener documentos');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en obtenerDocumentosPaciente:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene el listado de empleados de la clínica.
 */
export const obtenerEmpleados = async () => {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/api/pacientes/empleados`, {
      headers
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al obtener empleados');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error en obtenerEmpleados:', error.message);
    return { success: false, error: error.message };
  }
};
