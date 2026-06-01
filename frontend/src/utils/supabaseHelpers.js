import { supabase } from '../supabaseClient';

// ========== AUTENTICACIÓN ==========
export const iniciarSesion = async (dni, password) => {
  try {
    const { data: correoAuth, error: queryError } = await supabase
      .rpc('buscar_correo_por_dni', { p_dni: dni });

    if (queryError || !correoAuth) {
      return { success: false, error: 'DNI no registrado.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correoAuth,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) return { success: false, error: 'Contraseña incorrecta.' };
      if (error.message.includes('rate limit')) return { success: false, error: 'Demasiados intentos. Espera unos minutos.' };
      return { success: false, error: 'Error al iniciar sesión.' };
    }
    return { success: true, data };
  } catch (err) {
    console.error('Error al iniciar sesión:', err);
    return { success: false, error: 'Error de conexión.' };
  }
};

export const cerrarSesion = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ========== HISTORIA CLÍNICA ==========
export const obtenerUltimoNumeroHC = async () => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('numero_hc')
      .order('numero_hc', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.numero_hc || null;
  } catch (error) {
    console.error('Error al obtener último HC:', error.message);
    return null;
  }
};

// ========== PERFILES ==========
export const registrarPerfil = async (perfilData) => {
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .insert([perfilData])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const verificarDuplicadoDNI = async (dni) => {
  try {
    const cleanDni = dni ? String(dni).replace(/\D/g, '') : '';
    const { data: duplicated, error } = await supabase
      .rpc('verificar_duplicado_dni', { p_dni: cleanDni });

    if (error) throw error;
    return { duplicated: !!duplicated };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ========== PACIENTES ==========
export const registrarPaciente = async (pacienteData) => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .insert([pacienteData])
      .select()
      .single();

    if (error) throw error;
    const mapped = data ? { ...data, id: data.id_paciente } : null;
    return { success: true, data: mapped };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const obtenerPacienteActual = async (authId) => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_perfil_propio', authId)
      .maybeSingle();

    if (error) throw error;
    const mapped = data ? { ...data, id: data.id_paciente } : null;
    return { success: true, data: mapped };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const actualizarPaciente = async (pacienteId, updateData) => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .update(updateData)
      .eq('id_paciente', pacienteId)
      .select()
      .single();

    if (error) throw error;
    const mapped = data ? { ...data, id: data.id_paciente } : null;
    return { success: true, data: mapped };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ========== APODERADOS / PACIENTES ASOCIADOS ==========
export const obtenerPacientesAsociados = async (apoderadoId) => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_apoderado', apoderadoId);

    if (error) throw error;
    const mappedData = data ? data.map(d => ({ ...d, id: d.id_paciente })) : [];
    return { success: true, data: mappedData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const obtenerApoderados = async (apoderadoId) => {
  return obtenerPacientesAsociados(apoderadoId);
};

// ========== CITAS ==========
export const obtenerCitasPaciente = async (pacienteId) => {
  try {
    const { data, error } = await supabase
      .from('citas')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('fecha_cita', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

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

// ========== EMPLEADOS ==========
export const obtenerEmpleados = async () => {
  try {
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('activo', true);

    if (error) throw error;
    // Map to include nombres_apellidos for frontend compatibility
    const mappedData = data ? data.map(emp => ({
      ...emp,
      nombres_apellidos: `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
    })) : [];
    return { success: true, data: mappedData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ========== SERVICIOS Y PAQUETES ==========
export const obtenerServicios = async () => {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('activo', true);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const obtenerPaquetes = async (servicioId) => {
  try {
    const { data, error } = await supabase
      .from('paquetes_catalogo')
      .select('*')
      .eq('servicio_id', servicioId)
      .eq('activo', true);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ========== DOCUMENTOS ==========
export const obtenerDocumentosPaciente = async (pacienteId) => {
  try {
    const { data, error } = await supabase
      .from('tramites_documentales')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ========== RELACIÓN PSICÓLOGA-SERVICIO, HORARIOS Y CITAS POR ID ==========
export const obtenerPsicologasPorServicio = async (servicioId) => {
  try {
    const { data: psRelations, error: relError } = await supabase
      .from('psicologo_servicio')
      .select('psicologo_id')
      .eq('servicio_id', servicioId);

    if (relError) throw relError;
    if (!psRelations || psRelations.length === 0) return { success: true, data: [] };

    const psicologoIds = psRelations.map(r => r.psicologo_id);

    const { data: employees, error: empError } = await supabase
      .from('empleados')
      .select('*')
      .in('id', psicologoIds)
      .eq('activo', true);

    if (empError) throw empError;

    const mappedData = employees ? employees.map(emp => ({
      ...emp,
      nombres_apellidos: `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
    })) : [];

    return { success: true, data: mappedData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const obtenerHorariosPsicologas = async (psicologoId, fecha) => {
  try {
    let query = supabase
      .from('horarios_psicologas')
      .select('*')
      .eq('psicologo_id', psicologoId);

    if (fecha) {
      query = query.eq('fecha', fecha);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const obtenerCitasPsicologa = async (psicologoId, fecha) => {
  try {
    const { data, error } = await supabase
      .from('citas')
      .select('*')
      .eq('psicologo_id', psicologoId)
      .eq('fecha_cita', fecha)
      .neq('estado_cita', 'cancelada');

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};