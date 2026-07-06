import { supabase } from '../config/supabase.js';
import { cleanDni } from '../utils/validators.js';
import { generarSiguienteHC } from '../utils/generateHC.js';
import crypto from 'crypto';
import { enviarCorreoVerificacionCuenta, enviarCorreoIndependizacion } from '../services/emailService.js';


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
      // Verificar si el DNI existe en pacientes en estado STANDBY (sin cuenta propia)
      const dniClean = String(dni).replace(/\D/g, '');
      const { data: paciente, error: pacError } = await supabase
        .from('pacientes')
        .select('id_paciente, id_perfil_propio')
        .eq('dni', dniClean)
        .maybeSingle();

      if (!pacError && paciente && !paciente.id_perfil_propio) {
        return res.status(400).json({
          success: false,
          code: 'STANDBY_PACIENTE',
          error: 'Este paciente ya está registrado, pero aún no cuenta con acceso independiente.'
        });
      }

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
    const { suffix } = req.query;
    let query = supabase.from('pacientes').select('numero_hc');
    if (suffix) {
      query = query.like('numero_hc', `%${suffix}`);
    }
    const { data, error } = await query
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
    let { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', authId)
      .maybeSingle();

    if (error) throw error;

    // Fallback de autogeneración de perfil si no existe pero la sesión es válida en Supabase Auth
    if (!data) {
      const { data: authUser, error: authUserErr } = await supabase.auth.admin.getUserById(authId);
      if (!authUserErr && authUser?.user) {
        const user = authUser.user;
        const meta = user.user_metadata || {};
        const nombres = meta.nombres || user.email?.split('@')[0] || 'Usuario';
        
        let finalDni = meta.dni;
        if (!finalDni) {
          const { data: pac } = await supabase
            .from('pacientes')
            .select('dni')
            .eq('correo', user.email)
            .maybeSingle();
          finalDni = pac?.dni || `GEN_${authId.substring(0, 8)}`;
        }
        
        const { data: newPerfil, error: insErr } = await supabase
          .from('perfiles')
          .insert([{
            id: authId,
            dni: finalDni,
            nombres: nombres,
            apellido_paterno: meta.apellido_paterno || 'CEPSITCED',
            apellido_materno: meta.apellido_materno || '',
            correo: user.email,
            activo: true
          }])
          .select()
          .maybeSingle();

        if (!insErr && newPerfil) {
          data = newPerfil;
        } else {
          console.error('[getPerfilActual] Falló la inserción del fallback de perfil:', insErr?.message);
        }
      }
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener perfil actual:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};


export const postRegistrarPaciente = async (req, res) => {
  const pacienteData = req.body;
  
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

  // Heredar correo y teléfono del apoderado si no se especifican
  if (pacienteData.id_apoderado && (!pacienteData.telefono || !pacienteData.correo)) {
    try {
      const { data: apoderadoPerfil } = await supabase
        .from('perfiles')
        .select('telefono, correo')
        .eq('id', pacienteData.id_apoderado)
        .maybeSingle();
        
      if (apoderadoPerfil) {
        if (!pacienteData.telefono) pacienteData.telefono = apoderadoPerfil.telefono;
        if (!pacienteData.correo) pacienteData.correo = apoderadoPerfil.correo;
      }
    } catch (err) {
      console.error('Error al heredar contacto del apoderado:', err.message);
    }
  }

  try {
    let patientHC = pacienteData.numero_hc;
    
    if (!patientHC) {
      let insertSuccess = false;
      let attempts = 0;
      let finalData = null;
      
      while (attempts < 3 && !insertSuccess) {
        attempts++;
        try {
          patientHC = await generarSiguienteHC(supabase, pacienteData.fecha_nacimiento, pacienteData.genero);
          const cleanedData = filterValidPatientFields({ ...pacienteData, numero_hc: patientHC });
          
          const { data, error } = await supabase
            .from('pacientes')
            .insert([cleanedData])
            .select()
            .single();
            
          if (error) {
            if (error.code === '23505') {
              console.log(`Colisión de HC detectada al registrar paciente individual (${patientHC}). Reintentando (${attempts}/3)...`);
              continue;
            }
            throw error;
          }
          
          insertSuccess = true;
          finalData = data;
        } catch (err) {
          if (attempts >= 3) throw err;
        }
      }
      
      const mapped = finalData ? { ...finalData, id: finalData.id_paciente } : null;
      return res.json({ success: true, data: mapped });
    } else {
      const cleanedData = filterValidPatientFields(pacienteData);
      const { data, error } = await supabase
        .from('pacientes')
        .insert([cleanedData])
        .select()
        .single();

      if (error) throw error;
      const mapped = data ? { ...data, id: data.id_paciente } : null;
      return res.json({ success: true, data: mapped });
    }
  } catch (error) {
    console.error('Error al registrar paciente:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Obtener paciente actual (del usuario logueado)
export const getPacienteActual = async (req, res) => {
  const authId = req.user.id;
  try {
    let { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_perfil_propio', authId)
      .maybeSingle();

    if (error) throw error;

    // Fallback de autogeneración: si no existe la ficha clínica pero sí el perfil,
    // creamos o vinculamos la ficha clínica automáticamente para evitar bloquear al usuario.
    if (!data) {

      const { data: perfil, error: perfilErr } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', authId)
        .maybeSingle();

      if (!perfilErr && perfil) {
        try {
          // 1. Verificar si ya existe una ficha clínica por DNI
          const { data: existente, error: extErr } = await supabase
            .from('pacientes')
            .select('*')
            .eq('dni', perfil.dni)
            .maybeSingle();

          if (!extErr && existente) {

            const { data: updatedPaciente, error: updErr } = await supabase
              .from('pacientes')
              .update({
                id_perfil_propio: authId,
                nombres: perfil.nombres || existente.nombres,
                apellido_paterno: perfil.apellido_paterno || existente.apellido_paterno,
                apellido_materno: perfil.apellido_materno || existente.apellido_materno,
                telefono: perfil.telefono || existente.telefono,
                correo: perfil.correo || existente.correo
              })
              .eq('id_paciente', existente.id_paciente)
              .select()
              .maybeSingle();

            if (!updErr && updatedPaciente) {

              data = updatedPaciente;
            } else {
              console.error('[getPacienteActual] Falló la vinculación de la ficha clínica:', updErr?.message);
            }
          } else {
            // 2. Si no existe, creamos una nueva ficha
            const generatedHCs = [];
            const birthDate = perfil.fecha_nacimiento || '2000-01-01';
            const patientHC = await generarSiguienteHC(supabase, birthDate, 'Masculino', generatedHCs);

            const { data: newPaciente, error: insErr } = await supabase
              .from('pacientes')
              .insert([{
                numero_hc: patientHC,
                dni: perfil.dni,
                genero: 'Masculino', // Valor por defecto
                fecha_nacimiento: birthDate,
                telefono: perfil.telefono || null,
                correo: perfil.correo,
                nombres: perfil.nombres,
                apellido_paterno: perfil.apellido_paterno,
                apellido_materno: perfil.apellido_materno,
                estado_cuenta: 'INDEPENDIENTE',
                id_perfil_propio: authId,
                id_apoderado: null
              }])
              .select()
              .maybeSingle();

            if (!insErr && newPaciente) {

              data = newPaciente;
            } else {
              console.error('[getPacienteActual] Falló la inserción del fallback de paciente:', insErr?.message);
            }
          }
        } catch (genErr) {
          console.error('[getPacienteActual] Error al autogenerar ficha clínica:', genErr.message);
        }
      }
    }

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

    // Query simplificada - SIN joins anidados que pueden fallar silenciosamente
    const { data, error } = await supabase
      .from('tramites_documentales')
      .select('*')
      .eq('paciente_id', id)
      .eq('habilitar_visualizacion', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Si no hay datos, devolver array vacío
    if (!data || data.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Enriquecer cada documento con nombres de paciente, servicio y empleado por separado
    const enrichedDocs = await Promise.all(data.map(async (doc) => {
      const enriched = { ...doc };

      // Obtener nombre del paciente
      if (doc.paciente_id) {
        const { data: pac } = await supabase
          .from('pacientes')
          .select('nombres, apellido_paterno, apellido_materno')
          .eq('id_paciente', doc.paciente_id)
          .maybeSingle();
        enriched.pacientes = pac || null;
      }

      // Obtener nombre del servicio
      if (doc.servicio_id) {
        const { data: svc } = await supabase
          .from('servicios')
          .select('nombre_servicio')
          .eq('id', doc.servicio_id)
          .maybeSingle();
        enriched.servicios = svc || null;
      } else if (doc.servicio) {
        enriched.servicios = { nombre_servicio: doc.servicio };
      }

      // Obtener nombre del empleado
      if (doc.empleado_id) {
        const { data: emp } = await supabase
          .from('empleados')
          .select('nombres, apellido_paterno, apellido_materno')
          .eq('id', doc.empleado_id)
          .maybeSingle();
        enriched.empleados = emp || null;
      }

      return enriched;
    }));

    return res.json({ success: true, data: enrichedDocs });
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
    const mappedData = data ? data
      .filter(emp => emp.ofrece_servicios !== false)
      .map(emp => ({
        ...emp,
        nombres_apellidos: `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
      })) : [];
    return res.json({ success: true, data: mappedData });
  } catch (error) {
    console.error('Error al obtener empleados:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const toTitleCase = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s\-])\p{L}/gu, char => char.toUpperCase());
};

// Registro unificado de paciente independiente, apoderado y dependiente desde el backend
export const registrarPacienteConsolidado = async (req, res) => {
  const { 
    isProxy, 
    password, 
    patientData, 
    proxyData,
    direccion,
    departamento,
    provincia,
    distrito,
    genero,
    sexo,
    pais,
    lugarFamilia,
    lugar_familia,
    estadoCivil,
    estado_civil,
    gradoInstruccion,
    grado_instruccion,
    ocupacion,
    fechaNacimiento,
    fecha_nacimiento,
    telefono,
    nombres,
    apellidoPaterno,
    apellido_paterno,
    apellidoMaterno,
    apellido_materno,
    correo,
    correoReal
  } = req.body;

  let authId = null;

  try {
    const patientDniClean = String(patientData?.dni || req.body.dni || '').replace(/\D/g, '');
    const proxyDniClean = isProxy ? String(proxyData?.dni || req.body.proxyDni || '').replace(/\D/g, '') : '';
    
    // Unificar campos del paciente con fallbacks robustos
    const finalDireccion = patientData?.direccion || direccion;
    const finalPais = patientData?.pais || pais;
    const finalDepartamento = patientData?.departamento || departamento;
    const finalProvincia = patientData?.provincia || provincia;
    const finalDistrito = patientData?.distrito || distrito;
    const finalGenero = patientData?.genero || genero || sexo;
    
    const finalLugarFamilia = patientData?.lugarFamilia || lugarFamilia || lugar_familia;
    const finalEstadoCivil = patientData?.estadoCivil || estadoCivil || estado_civil;
    const finalGradoInstruccion = patientData?.gradoInstruccion || gradoInstruccion || grado_instruccion;
    const finalOcupacion = patientData?.ocupacion || ocupacion;
    
    const finalFechaNacimiento = patientData?.fechaNacimiento || fechaNacimiento || fecha_nacimiento;
    const finalTelefono = patientData?.telefono || telefono;
    
    const finalNombres = patientData?.nombres || nombres;
    const finalApellidoPaterno = patientData?.apellidoPaterno || apellidoPaterno || apellido_paterno;
    const finalApellidoMaterno = patientData?.apellidoMaterno || apellidoMaterno || apellido_materno;
    
    const finalCorreoReal = patientData?.correoReal || correoReal || correo;

    const isPeru = String(finalPais || '').trim().toLowerCase().startsWith('per');

    if (!patientDniClean) {
      return res.status(400).json({ success: false, error: 'El DNI del paciente es obligatorio.' });
    }

    // 1. Validaciones preliminares de duplicado de DNI
    const { data: pDup, error: pDupErr } = await supabase.rpc('verificar_duplicado_dni', { p_dni: patientDniClean });
    if (pDupErr) throw new Error(`Error al verificar DNI del paciente: ${pDupErr.message}`);
    if (pDup) return res.status(400).json({ success: false, error: 'Ya existe un perfil registrado con el DNI del paciente.' });

    if (isProxy) {
      if (patientDniClean === proxyDniClean) {
        return res.status(400).json({ success: false, error: 'El DNI del apoderado y del paciente no pueden ser iguales.' });
      }
      const { data: aDup, error: aDupErr } = await supabase.rpc('verificar_duplicado_dni', { p_dni: proxyDniClean });
      if (aDupErr) throw new Error(`Error al verificar DNI del apoderado: ${aDupErr.message}`);
      if (aDup) return res.status(400).json({ success: false, error: 'Ya existe un perfil registrado con el DNI del apoderado.' });
    }

    // 2. Registro Auth en Supabase
    const authEmail = isProxy 
      ? (proxyData?.correoReal || finalCorreoReal || '').trim().toLowerCase() 
      : (finalCorreoReal || '').trim().toLowerCase();

    // signUp en Supabase utilizando la instancia service role
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password,
    });

    if (authError) {
      throw new Error(`Error de registro Auth: ${authError.message}`);
    }

    authId = authData.user?.id;
    if (!authId) throw new Error('No se pudo crear la cuenta de usuario.');

    // List para acumular HCs generados en esta sesión de registro (evitar colisión local)
    const generatedHCs = [];

    // --- CASO 1: PACIENTE INDEPENDIENTE ---
    if (!isProxy) {
      // 3. Crear Perfil
      const { data: newPerfil, error: perfilErr } = await supabase
        .from('perfiles')
        .insert([{
          id: authId,
          dni: patientDniClean,
          nombres: toTitleCase(finalNombres) || null,
          apellido_paterno: toTitleCase(finalApellidoPaterno) || null,
          apellido_materno: toTitleCase(finalApellidoMaterno) || null,
          fecha_nacimiento: finalFechaNacimiento,
          telefono: finalTelefono || null,
          correo: authEmail,
          activo: false
        }])
        .select()
        .single();

      if (perfilErr) throw new Error(`Error al crear perfil de usuario: ${perfilErr.message}`);
      
      const profileId = newPerfil.id;

      // 4. Crear Ficha Clínica en Pacientes (con reintento de colisión HC 23505)
      let patientHC = '';
      let insertSuccess = false;
      let attempts = 0;

      // Buscar si ya existía la ficha clínica del paciente por DNI
      const { data: pacienteExistente } = await supabase
        .from('pacientes')
        .select('*')
        .eq('dni', patientDniClean)
        .maybeSingle();

      if (pacienteExistente) {
        const { error: pacUpdateErr } = await supabase
          .from('pacientes')
          .update({
            id_perfil_propio: profileId,
            nombres: toTitleCase(finalNombres) || pacienteExistente.nombres,
            apellido_paterno: toTitleCase(finalApellidoPaterno) || pacienteExistente.apellido_paterno,
            apellido_materno: toTitleCase(finalApellidoMaterno) || pacienteExistente.apellido_materno,
            telefono: finalTelefono || pacienteExistente.telefono,
            correo: authEmail,
            genero: finalGenero || pacienteExistente.genero,
            fecha_nacimiento: finalFechaNacimiento || pacienteExistente.fecha_nacimiento,
            pais: toTitleCase(finalPais) || pacienteExistente.pais,
            departamento: isPeru ? (toTitleCase(finalDepartamento) || pacienteExistente.departamento) : null,
            provincia: isPeru ? (toTitleCase(finalProvincia) || pacienteExistente.provincia) : null,
            distrito: isPeru ? (toTitleCase(finalDistrito) || pacienteExistente.distrito) : null,
            direccion: toTitleCase(finalDireccion) || pacienteExistente.direccion,
            lugar_familia: toTitleCase(finalLugarFamilia) || pacienteExistente.lugar_familia,
            estado_civil: toTitleCase(finalEstadoCivil) || pacienteExistente.estado_civil,
            grado_instruccion: toTitleCase(finalGradoInstruccion) || pacienteExistente.grado_instruccion,
            ocupacion: toTitleCase(finalOcupacion) || pacienteExistente.ocupacion,
            estado_cuenta: 'INDEPENDIENTE'
          })
          .eq('id_paciente', pacienteExistente.id_paciente);

        if (pacUpdateErr) throw new Error(`Error al actualizar ficha clínica existente: ${pacUpdateErr.message}`);
        patientHC = pacienteExistente.numero_hc;
      } else {
        while (attempts < 3 && !insertSuccess) {
          attempts++;
          try {
            patientHC = await generarSiguienteHC(supabase, finalFechaNacimiento, finalGenero, generatedHCs);
            
            const { error: pacInsErr } = await supabase
              .from('pacientes')
              .insert([{
                numero_hc: patientHC,
                dni: patientDniClean,
                genero: finalGenero,
                fecha_nacimiento: finalFechaNacimiento,
                lugar_familia: toTitleCase(finalLugarFamilia) || null,
                estado_civil: toTitleCase(finalEstadoCivil) || null,
                grado_instruccion: toTitleCase(finalGradoInstruccion) || null,
                ocupacion: toTitleCase(finalOcupacion) || null,
                direccion: toTitleCase(finalDireccion) || null,
                telefono: finalTelefono || null,
                correo: authEmail,
                nombres: toTitleCase(finalNombres) || null,
                apellido_paterno: toTitleCase(finalApellidoPaterno) || null,
                apellido_materno: toTitleCase(finalApellidoMaterno) || null,
                pais: toTitleCase(finalPais) || null,
                departamento: isPeru ? toTitleCase(finalDepartamento) : null,
                provincia: isPeru ? toTitleCase(finalProvincia) : null,
                distrito: isPeru ? toTitleCase(finalDistrito) : null,
                estado_cuenta: 'INDEPENDIENTE',
                id_perfil_propio: profileId,
                id_apoderado: null
              }]);

            if (pacInsErr) {
              if (pacInsErr.code === '23505') {

                continue;
              }
              throw pacInsErr;
            }
            insertSuccess = true;
          } catch (err) {
            if (attempts >= 3) throw err;
          }
        }
      }

      // Generar token de verificación
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
      const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      // Insertar token en tokens_verificacion
      const { error: tokenErr } = await supabase
        .from('tokens_verificacion')
        .insert([{
          perfil_id: profileId,
          token_hash: tokenHash,
          expira_en: expiraEn.toISOString()
        }]);

      if (tokenErr) {
        throw new Error(`Error al crear el token de verificación: ${tokenErr.message}`);
      }

      // Enviar correo de verificación
      const verifyLink = `${req.protocol}://${req.get('host')}/api/auth/confirmar-cuenta/${verificationToken}`;
      const emailResult = await enviarCorreoVerificacionCuenta(
        authEmail,
        finalNombres,
        verifyLink
      );

      if (!emailResult.success) {
        throw new Error(`No se pudo enviar el correo de verificación: ${emailResult.error}`);
      }

      return res.json({
        success: true,
        data: {
          authData,
          hcMostrada: patientHC
        }
      });
    }

    // --- CASO 2: REGISTRO CON APODERADO (ORDEN ESTRICTO: APODERADO PRIMERO, DEPENDIENTE DESPUÉS) ---
    else {
      // 3. Crear Perfil del Apoderado
      const { data: newProxyPerfil, error: perfilErr } = await supabase
        .from('perfiles')
        .insert([{
          id: authId,
          dni: proxyDniClean,
          nombres: toTitleCase(proxyData?.nombres) || null,
          apellido_paterno: toTitleCase(proxyData?.apellidoPaterno) || null,
          apellido_materno: toTitleCase(proxyData?.apellidoMaterno) || null,
          fecha_nacimiento: proxyData?.fechaNacimiento,
          telefono: proxyData?.telefono || null,
          correo: authEmail,
          activo: false
        }])
        .select()
        .single();

      if (perfilErr) throw new Error(`Error al crear perfil del apoderado: ${perfilErr.message}`);
      
      const proxyProfileId = newProxyPerfil.id;

      // 4. Crear Ficha Clínica del Apoderado en Pacientes (Campos clínicos vacíos/null permitidos)
      let proxyHC = '';
      let proxyInsertSuccess = false;
      let proxyAttempts = 0;

      const { data: apoderadoExistente } = await supabase
        .from('pacientes')
        .select('*')
        .eq('dni', proxyDniClean)
        .maybeSingle();

      if (apoderadoExistente) {
        const { error: apoUpdateErr } = await supabase
          .from('pacientes')
          .update({
            id_perfil_propio: proxyProfileId,
            nombres: toTitleCase(proxyData?.nombres) || apoderadoExistente.nombres,
            apellido_paterno: toTitleCase(proxyData?.apellidoPaterno) || apoderadoExistente.apellido_paterno,
            apellido_materno: toTitleCase(proxyData?.apellidoMaterno) || apoderadoExistente.apellido_materno,
            telefono: proxyData?.telefono || apoderadoExistente.telefono,
            correo: authEmail,
            genero: proxyData?.genero || apoderadoExistente.genero,
            fecha_nacimiento: proxyData?.fechaNacimiento || apoderadoExistente.fecha_nacimiento,
            direccion: toTitleCase(finalDireccion) || apoderadoExistente.direccion,
            pais: toTitleCase(finalPais) || apoderadoExistente.pais,
            departamento: isPeru ? (toTitleCase(finalDepartamento) || apoderadoExistente.departamento) : null,
            provincia: isPeru ? (toTitleCase(finalProvincia) || apoderadoExistente.provincia) : null,
            distrito: isPeru ? (toTitleCase(finalDistrito) || apoderadoExistente.distrito) : null,
            estado_cuenta: 'INDEPENDIENTE'
          })
          .eq('id_paciente', apoderadoExistente.id_paciente);

        if (apoUpdateErr) throw new Error(`Error al actualizar ficha clínica del apoderado: ${apoUpdateErr.message}`);
        proxyHC = apoderadoExistente.numero_hc;
        generatedHCs.push(proxyHC);
      } else {
        while (proxyAttempts < 3 && !proxyInsertSuccess) {
          proxyAttempts++;
          try {
            proxyHC = await generarSiguienteHC(supabase, proxyData?.fechaNacimiento, proxyData?.genero, generatedHCs);
            
            const { error: apoInsErr } = await supabase
              .from('pacientes')
              .insert([{
                numero_hc: proxyHC,
                dni: proxyDniClean,
                genero: proxyData?.genero,
                fecha_nacimiento: proxyData?.fechaNacimiento,
                direccion: toTitleCase(finalDireccion) || null,
                telefono: proxyData?.telefono || null,
                correo: authEmail,
                nombres: toTitleCase(proxyData?.nombres) || null,
                apellido_paterno: toTitleCase(proxyData?.apellidoPaterno) || null,
                apellido_materno: toTitleCase(proxyData?.apellidoMaterno) || null,
                pais: toTitleCase(finalPais) || null,
                departamento: isPeru ? toTitleCase(finalDepartamento) : null,
                provincia: isPeru ? toTitleCase(finalProvincia) : null,
                distrito: isPeru ? toTitleCase(finalDistrito) : null,
                estado_cuenta: 'INDEPENDIENTE',
                id_perfil_propio: proxyProfileId,
                id_apoderado: null
              }]);

            if (apoInsErr) {
              if (apoInsErr.code === '23505') {

                continue;
              }
              throw apoInsErr;
            }
            proxyInsertSuccess = true;
            generatedHCs.push(proxyHC);
          } catch (err) {
            if (proxyAttempts >= 3) throw err;
          }
        }
      }

      // 5. Crear Ficha Clínica del Paciente Dependiente en Pacientes
      let patientHC = '';
      let patientInsertSuccess = false;
      let patientAttempts = 0;

      const { data: pacienteExistente } = await supabase
        .from('pacientes')
        .select('*')
        .eq('dni', patientDniClean)
        .maybeSingle();

      if (pacienteExistente) {
        const { error: pacUpdateErr } = await supabase
          .from('pacientes')
          .update({
            id_apoderado: proxyProfileId,
            estado_cuenta: 'STANDBY',
            parentesco: toTitleCase(proxyData?.parentesco) || pacienteExistente.parentesco,
            nombres: toTitleCase(finalNombres) || pacienteExistente.nombres,
            apellido_paterno: toTitleCase(finalApellidoPaterno) || pacienteExistente.apellido_paterno,
            apellido_materno: toTitleCase(finalApellidoMaterno) || pacienteExistente.apellido_materno,
            telefono: proxyData?.telefono || finalTelefono, // Heredado u opcional
            correo: authEmail, // Heredado
            genero: finalGenero || pacienteExistente.genero,
            fecha_nacimiento: finalFechaNacimiento || pacienteExistente.fecha_nacimiento,
            direccion: toTitleCase(finalDireccion) || pacienteExistente.direccion,
            pais: toTitleCase(finalPais) || pacienteExistente.pais,
            departamento: isPeru ? (toTitleCase(finalDepartamento) || pacienteExistente.departamento) : null,
            provincia: isPeru ? (toTitleCase(finalProvincia) || pacienteExistente.provincia) : null,
            distrito: isPeru ? (toTitleCase(finalDistrito) || pacienteExistente.distrito) : null,
            lugar_familia: toTitleCase(finalLugarFamilia) || pacienteExistente.lugar_familia,
            estado_civil: toTitleCase(finalEstadoCivil) || pacienteExistente.estado_civil,
            grado_instruccion: toTitleCase(finalGradoInstruccion) || pacienteExistente.grado_instruccion,
            ocupacion: toTitleCase(finalOcupacion) || pacienteExistente.ocupacion
          })
          .eq('id_paciente', pacienteExistente.id_paciente);

        if (pacUpdateErr) throw new Error(`Error al actualizar ficha clínica del dependiente: ${pacUpdateErr.message}`);
        patientHC = pacienteExistente.numero_hc;
      } else {
        while (patientAttempts < 3 && !patientInsertSuccess) {
          patientAttempts++;
          try {
            patientHC = await generarSiguienteHC(supabase, finalFechaNacimiento, finalGenero, generatedHCs);
            
            const { error: pacInsErr } = await supabase
              .from('pacientes')
              .insert([{
                numero_hc: patientHC,
                dni: patientDniClean,
                genero: finalGenero,
                fecha_nacimiento: finalFechaNacimiento,
                lugar_familia: toTitleCase(finalLugarFamilia) || null,
                estado_civil: toTitleCase(finalEstadoCivil) || null,
                grado_instruccion: toTitleCase(finalGradoInstruccion) || null,
                ocupacion: toTitleCase(finalOcupacion) || null,
                direccion: toTitleCase(finalDireccion) || null,
                telefono: proxyData?.telefono || null, // Heredado
                correo: authEmail, // Heredado
                nombres: toTitleCase(finalNombres) || null,
                apellido_paterno: toTitleCase(finalApellidoPaterno) || null,
                apellido_materno: toTitleCase(finalApellidoMaterno) || null,
                pais: toTitleCase(finalPais) || null,
                departamento: isPeru ? toTitleCase(finalDepartamento) : null,
                provincia: isPeru ? toTitleCase(finalProvincia) : null,
                distrito: isPeru ? toTitleCase(finalDistrito) : null,
                estado_cuenta: 'STANDBY',
                id_perfil_propio: null,
                id_apoderado: proxyProfileId,
                parentesco: toTitleCase(proxyData?.parentesco) || null
              }]);

            if (pacInsErr) {
              if (pacInsErr.code === '23505') {

                continue;
              }
              throw pacInsErr;
            }
            patientInsertSuccess = true;
          } catch (err) {
            if (patientAttempts >= 3) throw err;
          }
        }
      }

      // Generar token de verificación
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
      const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      // Insertar token en tokens_verificacion
      const { error: tokenErr } = await supabase
        .from('tokens_verificacion')
        .insert([{
          perfil_id: proxyProfileId,
          token_hash: tokenHash,
          expira_en: expiraEn.toISOString()
        }]);

      if (tokenErr) {
        throw new Error(`Error al crear el token de verificación: ${tokenErr.message}`);
      }

      // Enviar correo de verificación
      const verifyLink = `${req.protocol}://${req.get('host')}/api/auth/confirmar-cuenta/${verificationToken}`;
      const emailResult = await enviarCorreoVerificacionCuenta(
        authEmail,
        proxyData?.nombres || finalNombres,
        verifyLink
      );

      if (!emailResult.success) {
        throw new Error(`No se pudo enviar el correo de verificación: ${emailResult.error}`);
      }

      return res.json({
        success: true,
        data: {
          authData,
          hcPacienteMostrada: patientHC,
          hcApoderadoMostrada: proxyHC
        }
      });
    }

  } catch (err) {
    console.error('Error en registrarPacienteConsolidado:', err.message);

    // Rollback de Supabase Auth
    if (authId) {
      try {
        await supabase.auth.admin.deleteUser(authId);

      } catch (deleteError) {
        console.error('Error durante rollback de Auth:', deleteError.message);
      }
    }

    return res.status(500).json({ success: false, error: err.message || 'Error interno del servidor durante el registro.' });
  }
};

// Recuperación de acceso bifurcada (Recuperación normal vs Independización)
export const recuperarAcceso = async (req, res) => {
  const { dni, sendEmail } = req.body;
  if (!dni) {
    return res.status(400).json({ success: false, error: 'El DNI es obligatorio.' });
  }
  
  try {
    const dniClean = String(dni).replace(/\D/g, '');
    
    // 1. Buscar en perfiles para ver si ya cuenta con acceso
    const { data: perfil, error: errPerfil } = await supabase
      .from('perfiles')
      .select('correo')
      .eq('dni', dniClean)
      .maybeSingle();
      
    if (errPerfil) throw errPerfil;
    
    if (perfil && perfil.correo) {
      // Flujo normal: ya tiene una cuenta activa
      return res.json({
        success: true,
        flow: 'NORMAL',
        email: perfil.correo
      });
    }
    
    // 2. Si no tiene perfil, buscar si existe en pacientes (dependiente standby)
    const { data: paciente, error: errPaciente } = await supabase
      .from('pacientes')
      .select('id_paciente, nombres, apellido_paterno, apellido_materno, id_perfil_propio, id_apoderado, correo')
      .eq('dni', dniClean)
      .maybeSingle();
      
    if (errPaciente) throw errPaciente;
    
    if (!paciente) {
      return res.status(404).json({
        success: false,
        error: 'El DNI ingresado no se encuentra registrado en el sistema.'
      });
    }
    
    // Validar si es mayor de edad (>= 18 años)
    if (paciente.fecha_nacimiento) {
      const birthDate = new Date(paciente.fecha_nacimiento);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        return res.status(400).json({
          success: false,
          error: 'El paciente es menor de edad y no puede independizar su cuenta. Por favor, comunícate con tu apoderado o asesor.'
        });
      }
    }
    
    // Si tiene id_perfil_propio pero no se encontró en perfiles
    if (paciente.id_perfil_propio) {
      return res.status(400).json({
        success: false,
        error: 'El paciente ya cuenta con una cuenta asociada.'
      });
    }
    
    // Flujo de independización: existe en pacientes pero id_perfil_propio es null
    let emailToUse = paciente.correo ? paciente.correo.trim() : '';
    const isEmailValid = /\S+@\S+\.\S+/.test(emailToUse);
    
    if (!isEmailValid) {
      // No hay correo directo válido en la ficha del paciente, buscar el del apoderado
      if (paciente.id_apoderado) {
        // Buscar en perfiles del apoderado
        const { data: apoderadoPerfil, error: errApoPerf } = await supabase
          .from('perfiles')
          .select('correo')
          .eq('id', paciente.id_apoderado)
          .maybeSingle();
          
        if (apoderadoPerfil && apoderadoPerfil.correo) {
          emailToUse = apoderadoPerfil.correo;
        } else {
          // Si no tiene perfil, buscar en pacientes del apoderado
          const { data: apoderadoPaciente, error: errApoPac } = await supabase
            .from('pacientes')
            .select('correo')
            .eq('id_perfil_propio', paciente.id_apoderado)
            .maybeSingle();
            
          if (apoderadoPaciente && apoderadoPaciente.correo) {
            emailToUse = apoderadoPaciente.correo;
          }
        }
      }
    }
    
    const finalEmail = emailToUse ? emailToUse.trim().toLowerCase() : '';
    if (!finalEmail || !/\S+@\S+\.\S+/.test(finalEmail)) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo resolver un correo de contacto válido para enviar la solicitud. Por favor, comunícate con administración.'
      });
    }

    if (!sendEmail) {
      // Solo consulta/verificación inicial de DNI
      return res.json({
        success: true,
        flow: 'INDEPENDIZACION',
        email: finalEmail,
        needsSending: true
      });
    }
    
    // Generar token de independización
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Insertar token en tokens_independizacion
    const { error: tokenErr } = await supabase
      .from('tokens_independizacion')
      .insert([{
        paciente_id: paciente.id_paciente,
        token_hash: tokenHash,
        expira_en: expiraEn.toISOString()
      }]);

    if (tokenErr) {
      throw new Error(`Error al crear el token de independización: ${tokenErr.message}`);
    }
    
    // Nombre completo del paciente
    const nombresCompletos = `${paciente.nombres || ''} ${paciente.apellido_paterno || ''} ${paciente.apellido_materno || ''}`.trim();
    
    // Enviar correo de independización al apoderado (titular a cargo)
    const approvalLink = `${req.protocol}://${req.get('host')}/api/auth/independizacion/aprobar/${verificationToken}`;
    const emailResult = await enviarCorreoIndependizacion(finalEmail, nombresCompletos, approvalLink);
    
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: emailResult.error || 'Error al enviar el correo de activación.'
      });
    }
    
    return res.json({
      success: true,
      flow: 'INDEPENDIZACION',
      email: finalEmail,
      sent: true
    });
    
  } catch (err) {
    console.error('Error en recuperarAcceso:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Error interno del servidor.' });
  }
};

// Verificar validez del token de independización
export const verificarTokenIndependizacion = async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ success: false, error: 'El token es obligatorio.' });
  }
  
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    const { data: record, error: findRecordError } = await supabase
      .from('tokens_independizacion')
      .select('*')
      .eq('token_hash', tokenHash)
      .gt('expira_en', now)
      .maybeSingle();

    if (findRecordError || !record) {
      return res.status(400).json({ success: false, error: 'El token es inválido o ha expirado.' });
    }
    
    // Buscar paciente y verificar que no esté ya independizado (evita reutilización)
    const { data: paciente, error: errPac } = await supabase
      .from('pacientes')
      .select('id_paciente, dni, nombres, apellido_paterno, apellido_materno, id_perfil_propio, correo')
      .eq('id_paciente', record.paciente_id)
      .maybeSingle();
      
    if (errPac) throw errPac;
    if (!paciente) {
      return res.status(404).json({ success: false, error: 'El paciente asociado a esta solicitud no existe.' });
    }
    
    if (paciente.id_perfil_propio) {
      return res.status(400).json({
        success: false,
        error: 'Esta cuenta ya ha sido activada anteriormente.'
      });
    }
    
    return res.json({
      success: true,
      data: {
        id_paciente: paciente.id_paciente,
        dni: paciente.dni,
        nombres: paciente.nombres,
        apellido_paterno: paciente.apellido_paterno,
        apellido_materno: paciente.apellido_materno,
        correoSugerido: paciente.correo
      }
    });
  } catch (err) {
    console.error('Error en verificarTokenIndependizacion:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Completar el proceso de independización: crear Auth, Perfil y actualizar Paciente
export const completarIndependizacion = async (req, res) => {
  const { token, email, password } = req.body;
  if (!token || !email || !password) {
    return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
  }
  
  let createdAuthId = null;
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    const { data: record, error: findRecordError } = await supabase
      .from('tokens_independizacion')
      .select('*')
      .eq('token_hash', tokenHash)
      .gt('expira_en', now)
      .maybeSingle();

    if (findRecordError || !record) {
      return res.status(400).json({ success: false, error: 'El token es inválido o ha expirado.' });
    }
    
    // 1. Obtener los datos del paciente existente
    const { data: paciente, error: errPac } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_paciente', record.paciente_id)
      .maybeSingle();
      
    if (errPac) throw errPac;
    if (!paciente) {
      return res.status(404).json({ success: false, error: 'El paciente asociado a esta solicitud no existe.' });
    }
    
    if (paciente.id_perfil_propio) {
      return res.status(400).json({
        success: false,
        error: 'Esta cuenta ya ha sido activada anteriormente.'
      });
    }

    // Verificar si el correo que quiere usar ya existe en Auth/Perfiles
    const emailClean = email.trim().toLowerCase();
    const { data: perfilExistente } = await supabase
      .from('perfiles')
      .select('id')
      .eq('correo', emailClean)
      .maybeSingle();

    if (perfilExistente) {
      return res.status(400).json({
        success: false,
        error: 'El correo electrónico ingresado ya se encuentra registrado por otro usuario.'
      });
    }
    
    // 2. Crear usuario Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emailClean,
      password: password,
      email_confirm: true
    });
    
    if (authError) {
      throw new Error(`Error al crear la cuenta de autenticación: ${authError.message}`);
    }
    
    createdAuthId = authData.user?.id;
    if (!createdAuthId) {
      throw new Error('No se pudo crear la cuenta de usuario.');
    }
    
    // 3. Crear Perfil
    const { error: errPerfil } = await supabase
      .from('perfiles')
      .insert([{
        id: createdAuthId,
        dni: paciente.dni,
        nombres: paciente.nombres,
        apellido_paterno: paciente.apellido_paterno,
        apellido_materno: paciente.apellido_materno,
        fecha_nacimiento: paciente.fecha_nacimiento,
        telefono: paciente.telefono,
        correo: emailClean,
        activo: true
      }]);
      
    if (errPerfil) {
      throw new Error(`Error al crear el perfil de usuario: ${errPerfil.message}`);
    }
    
    // 4. Actualizar Paciente Existente (Sin crear fila duplicada)
    const { error: errUpdatePac } = await supabase
      .from('pacientes')
      .update({
        id_perfil_propio: createdAuthId,
        id_apoderado: null,
        estado_cuenta: 'INDEPENDIENTE',
        correo: emailClean
      })
      .eq('id_paciente', paciente.id_paciente);
      
    if (errUpdatePac) {
      throw new Error(`Error al actualizar la ficha del paciente: ${errUpdatePac.message}`);
    }

    // Eliminar el token de independización
    await supabase
      .from('tokens_independizacion')
      .delete()
      .eq('id', record.id);
    
    return res.json({
      success: true,
      message: 'Cuenta activada e independizada con éxito.'
    });
    
  } catch (err) {
    console.error('Error en completarIndependizacion:', err.message);
    
    // Rollback: borrar usuario creado en Supabase Auth
    if (createdAuthId) {
      try {
        await supabase.auth.admin.deleteUser(createdAuthId);

      } catch (deleteError) {
        console.error('Error durante rollback en completarIndependizacion:', deleteError.message);
      }
    }
    
    return res.status(500).json({ success: false, error: err.message || 'Error del servidor al completar el proceso.' });
  }
};
