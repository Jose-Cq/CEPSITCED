import { supabase } from '../config/supabase.js';
import { cleanDni } from '../utils/validators.js';

// Helper para filtrar solo columnas válidas para la tabla "pacientes"
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

// Autenticación: buscar correo por DNI e iniciar sesión
export const login = async (req, res) => {
  const { dni, password } = req.body;
  if (!dni) {
    return res.status(400).json({ success: false, error: 'El DNI es obligatorio.' });
  }
  try {
    const { data: correoAuth, error: queryError } = await supabase
      .rpc('buscar_correo_por_dni', { p_dni: dni });

    if (queryError || !correoAuth) {
      return res.status(400).json({ success: false, error: 'DNI no registrado o error de búsqueda.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correoAuth,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return res.status(400).json({ success: false, error: 'Contraseña incorrecta.' });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error en login:', err.message);
    return res.status(500).json({ success: false, error: 'Error del servidor al iniciar sesión.' });
  }
};

// Obtener último número de HC
export const getUltimoNumeroHC = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('numero_hc')
      .order('numero_hc', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return res.json({ success: true, data: data?.numero_hc || null });
  } catch (error) {
    console.error('Error al obtener último HC:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Verificar duplicado de DNI
export const getVerificarDuplicadoDNI = async (req, res) => {
  const { dni } = req.query;
  if (!dni) {
    return res.status(400).json({ success: false, error: 'DNI es requerido.' });
  }
  try {
    const cleaned = cleanDni(dni);
    const { data: duplicated, error } = await supabase
      .rpc('verificar_duplicado_dni', { p_dni: cleaned });

    if (error) throw error;
    return res.json({ success: true, duplicated: !!duplicated });
  } catch (error) {
    console.error('Error al verificar DNI:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Registrar perfil (tabla perfiles)
export const postRegistrarPerfil = async (req, res) => {
  const perfilData = req.body;
  if (!perfilData.id) {
    return res.status(400).json({ success: false, error: 'El ID de perfil es requerido.' });
  }
  
  // Seguridad: el perfil a registrar debe coincidir con el usuario del token
  if (req.user.id !== perfilData.id) {
    return res.status(403).json({ success: false, error: 'No tienes permiso para registrar este perfil.' });
  }

  try {
    const { data, error } = await supabase
      .from('perfiles')
      .insert([perfilData])
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error al registrar perfil:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener perfil de usuario actual
export const getPerfilActual = async (req, res) => {
  const authId = req.user.id;
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', authId)
      .maybeSingle();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener perfil actual:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Registrar paciente (tabla pacientes)
export const postRegistrarPaciente = async (req, res) => {
  const pacienteData = req.body;
  
  if (!pacienteData.numero_hc) {
    return res.status(400).json({ success: false, error: "El número de historia clínica es obligatorio." });
  }
  if (!pacienteData.dni) {
    return res.status(400).json({ success: false, error: "El DNI/Documento es obligatorio." });
  }
  if (!pacienteData.genero) {
    return res.status(400).json({ success: false, error: "El género es obligatorio." });
  }
  if (!pacienteData.fecha_nacimiento) {
    return res.status(400).json({ success: false, error: "La fecha de nacimiento es obligatoria." });
  }

  // Seguridad: validar que el id_perfil_propio o id_apoderado coincida con el usuario del token
  const isSelf = pacienteData.id_perfil_propio === req.user.id;
  const isProxy = pacienteData.id_apoderado === req.user.id;
  if (!isSelf && !isProxy) {
    return res.status(403).json({ success: false, error: 'Acceso denegado: no coincide con tu perfil ni eres apoderado.' });
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
    return res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Error al registrar paciente:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener paciente actual (del usuario logueado)
export const getPacienteActual = async (req, res) => {
  const authId = req.user.id;
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_perfil_propio', authId)
      .maybeSingle();

    if (error) throw error;
    const mapped = data ? { ...data, id: data.id_paciente } : null;
    return res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Error al obtener paciente actual:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Actualizar paciente
export const putActualizarPaciente = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: 'ID de paciente no proporcionado.' });
  }

  try {
    // Seguridad: verificar primero que el paciente a actualizar pertenece al usuario o es su apoderado
    const { data: paciente, error: checkError } = await supabase
      .from('pacientes')
      .select('id_perfil_propio, id_apoderado')
      .eq('id_paciente', id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!paciente) {
      return res.status(404).json({ success: false, error: 'Paciente no encontrado.' });
    }

    if (paciente.id_perfil_propio !== req.user.id && paciente.id_apoderado !== req.user.id) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para actualizar este paciente.' });
    }

    const cleanedData = filterValidPatientFields(updateData);

    const { data, error } = await supabase
      .from('pacientes')
      .update(cleanedData)
      .eq('id_paciente', id)
      .select()
      .single();

    if (error) throw error;
    const mapped = data ? { ...data, id: data.id_paciente } : null;
    return res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Error al actualizar paciente:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener pacientes asociados (miembros de la familia del apoderado)
export const getPacientesAsociados = async (req, res) => {
  const apoderadoId = req.user.id;
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_apoderado', apoderadoId);

    if (error) throw error;
    const mappedData = data ? data.map(d => ({ ...d, id: d.id_paciente })) : [];
    return res.json({ success: true, data: mappedData });
  } catch (error) {
    console.error('Error al obtener pacientes asociados:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener documentos clínicos del paciente
export const getDocumentosPaciente = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID de paciente no proporcionado.' });
  }

  try {
    // Seguridad: verificar pertenencia del paciente antes de entregar documentos
    const { data: paciente, error: checkError } = await supabase
      .from('pacientes')
      .select('id_perfil_propio, id_apoderado')
      .eq('id_paciente', id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!paciente) {
      return res.status(404).json({ success: false, error: 'Paciente no encontrado.' });
    }

    if (paciente.id_perfil_propio !== req.user.id && paciente.id_apoderado !== req.user.id) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para ver los documentos de este paciente.' });
    }

    const { data, error } = await supabase
      .from('tramites_documentales')
      .select('*')
      .eq('paciente_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener documentos del paciente:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener empleados activos
export const getEmpleados = async (req, res) => {
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
    return res.json({ success: true, data: mappedData });
  } catch (error) {
    console.error('Error al obtener empleados:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
