import { supabase } from '../../frontend/src/supabaseClient.js';
import { cleanDni } from '../utils/validators.js';

// Helper to filter only valid columns for the "pacientes" table and remove undefined properties
const filterValidPatientFields = (data) => {
  const allowedKeys = [
    'numero_hc',
    'dni',
    'genero',
    'fecha_nacimiento',
    'lugar_familia',
    'estado_civil',
    'grado_instruccion',
    'ocupacion',
    'direccion',
    'telefono',
    'correo',
    'nombres',
    'apellido_paterno',
    'apellido_materno',
    'pais',
    'departamento',
    'provincia',
    'distrito',
    'estado_cuenta',
    'id_perfil_propio',
    'id_apoderado',
    'parentesco'
  ];

  const cleaned = {};
  for (const key in data) {
    if (allowedKeys.includes(key) && data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
};

/**
 * Signs in a user by first looking up email by DNI.
 * @param {string} dni 
 * @param {string} password 
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const iniciarSesion = async (dni, password) => {
  if (!dni) {
    return { success: false, error: 'El DNI es obligatorio.' };
  }
  try {
    const { data: correoAuth, error: queryError } = await supabase
      .rpc('buscar_correo_por_dni', { p_dni: dni });

    if (queryError) {
      console.error('Error Supabase en buscar_correo_por_dni:', {
        message: queryError.message,
        details: queryError.details,
        hint: queryError.hint,
        code: queryError.code
      });
      return { success: false, error: 'DNI no registrado o error de búsqueda.' };
    }
    if (!correoAuth) {
      return { success: false, error: 'DNI no registrado.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correoAuth,
      password,
    });

    if (error) {
      console.error('Error Supabase en signInWithPassword:', {
        message: error.message,
        code: error.code
      });
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

/**
 * Signs out the current user.
 * @returns {Promise<{success: boolean, error?: string}>}
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
 * Gets the highest medical history number.
 * @returns {Promise<string|null>}
 */
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

/**
 * Registers a new profile (perfiles).
 * @param {Object} perfilData 
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
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

/**
 * Checks if a DNI is already registered in perfiles.
 * @param {string} dni 
 * @returns {Promise<{duplicated: boolean, error?: string}>}
 */
export const verificarDuplicadoDNI = async (dni) => {
  try {
    const cleaned = cleanDni(dni);
    const { data: duplicated, error } = await supabase
      .rpc('verificar_duplicado_dni', { p_dni: cleaned });

    if (error) throw error;
    return { duplicated: !!duplicated };
  } catch (error) {
    return { duplicated: false, error: error.message };
  }
};

/**
 * Registers a new patient.
 * @param {Object} pacienteData 
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const registrarPaciente = async (pacienteData) => {
  console.log('Paciente payload enviado a Supabase:', pacienteData);

  if (!pacienteData.numero_hc) {
    return { success: false, error: "El número de historia clínica es obligatorio." };
  }
  if (!pacienteData.dni) {
    return { success: false, error: "El DNI/Documento es obligatorio." };
  }
  if (!pacienteData.genero) {
    return { success: false, error: "El género es obligatorio." };
  }
  if (!pacienteData.fecha_nacimiento) {
    return { success: false, error: "La fecha de nacimiento es obligatoria." };
  }

  const cleanedData = filterValidPatientFields(pacienteData);

  try {
    const { data, error } = await supabase
      .from('pacientes')
      .insert([cleanedData])
      .select()
      .single();

    if (error) throw error;
    const mapped = data ? { ...data, id: data.id_paciente } : null;
    return { success: true, data: mapped };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Fetches patient details by authenticated user ID.
 * @param {string} authId 
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const obtenerPacienteActual = async (authId) => {
  if (!authId) {
    console.warn('obtenerPacienteActual llamado sin authId válido.');
    return { success: false, error: 'ID de autenticación no proporcionado.' };
  }
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_perfil_propio', authId)
      .maybeSingle();

    if (error) {
      console.error('Error Supabase en obtenerPacienteActual:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    const mapped = data ? { ...data, id: data.id_paciente } : null;
    return { success: true, data: mapped };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Updates a patient details.
 * @param {string} pacienteId 
 * @param {Object} updateData 
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const actualizarPaciente = async (pacienteId, updateData) => {
  if (!pacienteId) {
    console.warn('actualizarPaciente llamado sin pacienteId válido.');
    return { success: false, error: 'ID de paciente no proporcionado.' };
  }
  const cleanedData = filterValidPatientFields(updateData);

  try {
    const { data, error } = await supabase
      .from('pacientes')
      .update(cleanedData)
      .eq('id_paciente', pacienteId)
      .select()
      .single();

    if (error) {
      console.error('Error Supabase en actualizarPaciente:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    const mapped = data ? { ...data, id: data.id_paciente } : null;
    return { success: true, data: mapped };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Fetches associated family profiles where this user is the apoderado.
 * @param {string} apoderadoId 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerPacientesAsociados = async (apoderadoId) => {
  if (!apoderadoId) {
    console.warn('obtenerPacientesAsociados llamado sin apoderadoId válido.');
    return { success: true, data: [] };
  }
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_apoderado', apoderadoId);

    if (error) {
      console.error('Error Supabase en obtenerPacientesAsociados:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    const mappedData = data ? data.map(d => ({ ...d, id: d.id_paciente })) : [];
    return { success: true, data: mappedData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Alias for obtaining associated patients.
 */
export const obtenerApoderados = async (apoderadoId) => {
  return obtenerPacientesAsociados(apoderadoId);
};

/**
 * Fetches all clinical document requests for a patient.
 * @param {string} pacienteId 
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerDocumentosPaciente = async (pacienteId) => {
  if (!pacienteId) {
    console.warn('obtenerDocumentosPaciente llamado sin pacienteId válido.');
    return { success: true, data: [] };
  }
  try {
    const { data, error } = await supabase
      .from('tramites_documentales')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error Supabase en obtenerDocumentosPaciente:', {
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
 * Fetches all active employees.
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const obtenerEmpleados = async () => {
  try {
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('activo', true);

    if (error) throw error;
    const mappedData = data ? data.map(emp => ({
      ...emp,
      nombres_apellidos: `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
    })) : [];
    return { success: true, data: mappedData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
