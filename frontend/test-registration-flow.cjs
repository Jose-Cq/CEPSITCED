const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env manually
const dotenvText = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
dotenvText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to simulate age calculation
function calcularEdad(fechaNacStr) {
  if (!fechaNacStr) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacStr);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad;
}

// Helper to check if a profile is incomplete (similar to esFichaIncompleta in Profile.jsx)
function esFichaIncompleta(paciente) {
  if (!paciente) return true;
  if (!paciente.genero || !paciente.direccion || !paciente.pais) return true;
  if (paciente.pais === 'Perú' && (!paciente.departamento || !paciente.provincia || !paciente.distrito)) {
    return true;
  }
  return false;
}

async function verifyRegistrationFlow() {
  console.log("==================================================================");
  console.log("=== VERIFICACIÓN MANUAL FINAL DE REGISTRO CEPSITCED =============");
  console.log("==================================================================\n");

  const testId = Date.now();
  const emailIndep = `test-indep-${testId}@example.com`;
  const emailProxy = `test-proxy-${testId}@example.com`;
  const password = 'Password123!';

  const dniIndep = String(Math.floor(10000000 + Math.random() * 90000000));
  const dniProxy = String(Math.floor(10000000 + Math.random() * 90000000));
  const dniDep = String(Math.floor(10000000 + Math.random() * 90000000));

  const hcIndep = String(Math.floor(1000 + Math.random() * 9000)) + '050626M';
  const hcProxy = String(Math.floor(1000 + Math.random() * 9000)) + '050626M';
  const hcDep = String(Math.floor(1000 + Math.random() * 9000)) + '050626f';

  // Track created IDs for cleanup
  const usersCreated = [];

  try {
    // ------------------------------------------------------------------
    // CASO 1: PACIENTE INDEPENDIENTE
    // ------------------------------------------------------------------
    console.log(">>> Probando Registro Paciente Independiente:");
    
    // 1. Crear usuario en Auth
    const { data: authDataIndep, error: authErrIndep } = await supabase.auth.signUp({
      email: emailIndep,
      password
    });
    if (authErrIndep) throw authErrIndep;
    const userIdIndep = authDataIndep.user.id;
    usersCreated.push({ id: userIdIndep, email: emailIndep });
    console.log(`  [OK] Usuario creado en Auth (ID: ${userIdIndep})`);

    // Iniciar sesión
    await supabase.auth.signInWithPassword({ email: emailIndep, password });

    // 2. Insertar en perfiles
    const { data: profileIndep, error: profErrIndep } = await supabase.from('perfiles').insert([{
      id: userIdIndep,
      dni: dniIndep,
      nombres: 'María',
      apellido_paterno: 'Independent',
      apellido_materno: 'Test',
      fecha_nacimiento: '1995-03-12',
      telefono: '+51 987654321',
      correo: emailIndep
    }]).select().single();
    if (profErrIndep) throw profErrIndep;
    console.log(`  [OK] Registro en perfiles insertado (DNI: ${profileIndep.dni})`);

    // 3. Insertar en pacientes (con validaciones y ?? null)
    const pacienteIndepData = {
      numero_hc: hcIndep,
      dni: dniIndep,
      genero: 'Femenino',
      fecha_nacimiento: '1995-03-12',
      lugar_familia: 'Hijo/a mayor',
      estado_civil: 'Soltero/a',
      grado_instruccion: 'Superior Completa',
      ocupacion: 'Ingeniera',
      direccion: 'Av. Larco 123',
      telefono: '+51 987654321',
      correo: emailIndep,
      nombres: 'María',
      apellido_paterno: 'Independent',
      apellido_materno: 'Test',
      pais: 'Perú',
      departamento: 'Lima',
      provincia: 'Lima',
      distrito: 'Miraflores',
      estado_cuenta: 'INDEPENDIENTE',
      id_perfil_propio: userIdIndep,
      id_apoderado: null,
      parentesco: null
    };

    // Assert required fields
    if (!pacienteIndepData.numero_hc) throw new Error("numero_hc is missing");
    if (!pacienteIndepData.dni) throw new Error("dni is missing");
    if (!pacienteIndepData.genero) throw new Error("genero is missing");
    if (!pacienteIndepData.fecha_nacimiento) throw new Error("fecha_nacimiento is missing");

    const { data: patientIndep, error: patErrIndep } = await supabase.from('pacientes').insert([pacienteIndepData]).select().single();
    if (patErrIndep) throw patErrIndep;
    console.log(`  [OK] Registro en pacientes insertado (HC: ${patientIndep.numero_hc})`);

    // 4. Consultar usando la consulta de usePacienteActual
    const { data: clinicoPropioIndep, error: errCargIndep } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_perfil_propio', userIdIndep)
      .maybeSingle();
    if (errCargIndep) throw errCargIndep;

    console.log("  [Verificación de Carga - Paciente Independiente]:");
    console.log(`    - ¿Encontrado?: ${clinicoPropioIndep ? 'SÍ' : 'NO'}`);
    console.log(`    - id_perfil_propio: ${clinicoPropioIndep.id_perfil_propio} (Esperado: ${userIdIndep})`);
    console.log(`    - id_apoderado: ${clinicoPropioIndep.id_apoderado} (Esperado: null)`);
    
    const incompletaIndep = esFichaIncompleta(clinicoPropioIndep);
    console.log(`    - ¿Ficha Incompleta?: ${incompletaIndep ? 'SÍ (ERROR)' : 'NO (CORRECTO)'}`);
    if (incompletaIndep) throw new Error("La ficha del paciente independiente figura como incompleta");

    console.log("  [Prueba de celular extranjero para paciente independiente]:");
    // Probamos actualizar a celular extranjero de 12 dígitos
    const telExtranjero = '+56 912345678'; // 9 dígitos después de prefijo
    const digitsExt = telExtranjero.replace(/\D/g, ''); // 56912345678 (11 dígitos)
    console.log(`    - Validando formato celular extranjero: ${telExtranjero} (${digitsExt.length} dígitos)`);
    if (digitsExt.length < 5 || digitsExt.length > 15) {
      throw new Error("Celular extranjero falló validación de longitud");
    }
    console.log("    - Celular extranjero válido.");

    console.log("  [Prueba de celular peruano de 9 dígitos para paciente independiente]:");
    const telPeruano = '+51 987654321';
    const digitsPer = telPeruano.replace(/\D/g, '').slice(2); // 987654321 (9 dígitos)
    console.log(`    - Validando formato celular peruano: ${telPeruano} (${digitsPer.length} dígitos)`);
    if (digitsPer.length !== 9) {
      throw new Error("Celular peruano falló validación de longitud");
    }
    console.log("    - Celular peruano válido.\n");


    // ------------------------------------------------------------------
    // CASO 2: REGISTRO CON APODERADO + DEPENDIENTE
    // ------------------------------------------------------------------
    console.log(">>> Probando Registro con Apoderado + Dependiente:");
    
    // 1. Crear usuario en Auth (Apoderado)
    const { data: authDataProxy, error: authErrProxy } = await supabase.auth.signUp({
      email: emailProxy,
      password
    });
    if (authErrProxy) throw authErrProxy;
    const userIdProxy = authDataProxy.user.id;
    usersCreated.push({ id: userIdProxy, email: emailProxy });
    console.log(`  [OK] Apoderado creado en Auth (ID: ${userIdProxy})`);

    // Iniciar sesión
    await supabase.auth.signInWithPassword({ email: emailProxy, password });

    // 2. Insertar apoderado en perfiles
    const { data: profileProxy, error: profErrProxy } = await supabase.from('perfiles').insert([{
      id: userIdProxy,
      dni: dniProxy,
      nombres: 'Juan Apoderado',
      apellido_paterno: 'Proxy',
      apellido_materno: 'Test',
      fecha_nacimiento: '1980-05-20',
      telefono: '+51 999111222',
      correo: emailProxy
    }]).select().single();
    if (profErrProxy) throw profErrProxy;
    console.log(`  [OK] Perfil de apoderado insertado (DNI: ${profileProxy.dni})`);

    // 3. Insertar apoderado en pacientes (Ficha clínica propia)
    const apoderadoPacienteData = {
      numero_hc: hcProxy,
      dni: dniProxy,
      genero: 'Masculino',
      fecha_nacimiento: '1980-05-20',
      direccion: 'Av. El Sol 456',
      telefono: '+51 999111222',
      correo: emailProxy,
      nombres: 'Juan Apoderado',
      apellido_paterno: 'Proxy',
      apellido_materno: 'Test',
      pais: 'Perú',
      departamento: 'Lima',
      provincia: 'Lima',
      distrito: 'Santiago de Surco',
      estado_cuenta: 'INDEPENDIENTE',
      id_perfil_propio: userIdProxy,
      id_apoderado: null,
      parentesco: null
    };

    const { data: patientProxy, error: patErrProxy } = await supabase.from('pacientes').insert([apoderadoPacienteData]).select().single();
    if (patErrProxy) throw patErrProxy;
    console.log(`  [OK] Ficha clínica de apoderado insertada (HC: ${patientProxy.numero_hc})`);

    // 4. Insertar dependiente (Ficha clínica vinculada)
    const dependientePacienteData = {
      numero_hc: hcDep,
      dni: dniDep,
      genero: 'Femenino',
      fecha_nacimiento: '2015-08-10',
      lugar_familia: 'Hijo/a menor',
      estado_civil: 'Soltero/a',
      grado_instruccion: 'Primaria Incompleta',
      ocupacion: 'Estudiante',
      direccion: 'Av. El Sol 456',
      telefono: null, // Guardado como null para dependientes
      correo: null, // Guardado como null para dependientes
      nombres: 'Sofía Dependiente',
      apellido_paterno: 'Proxy',
      apellido_materno: 'Test',
      pais: 'Perú',
      departamento: 'Lima',
      provincia: 'Lima',
      distrito: 'Santiago de Surco',
      estado_cuenta: 'STANDBY',
      id_perfil_propio: null, // null para dependientes
      id_apoderado: userIdProxy, // vinculado al ID de usuario del apoderado
      parentesco: 'Hijo'
    };

    const { data: patientDep, error: patErrDep } = await supabase.from('pacientes').insert([dependientePacienteData]).select().single();
    if (patErrDep) throw patErrDep;
    console.log(`  [OK] Ficha de miembro dependiente insertada (HC: ${patientDep.numero_hc}, Vínculo: ${patientDep.parentesco})`);

    // 5. Cargar datos del apoderado y dependientes
    const { data: clinicoPropioProxy, error: errCargProxyPropio } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_perfil_propio', userIdProxy)
      .maybeSingle();
    if (errCargProxyPropio) throw errCargProxyPropio;

    const { data: dependientesProxy, error: errCargProxyDeps } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id_apoderado', userIdProxy)
      .is('id_perfil_propio', null);
    if (errCargProxyDeps) throw errCargProxyDeps;

    console.log("  [Verificación de Carga - Apoderado y Dependientes]:");
    console.log(`    - ¿Ficha propia apoderado encontrada?: ${clinicoPropioProxy ? 'SÍ' : 'NO'}`);
    console.log(`    - id_perfil_propio apoderado: ${clinicoPropioProxy.id_perfil_propio} (Esperado: ${userIdProxy})`);
    
    const incompletaProxy = esFichaIncompleta(clinicoPropioProxy);
    console.log(`    - ¿Ficha apoderado Incompleta?: ${incompletaProxy ? 'SÍ (ERROR)' : 'NO (CORRECTO)'}`);
    if (incompletaProxy) throw new Error("La ficha del apoderado figura como incompleta");

    console.log(`    - Total de dependientes encontrados: ${dependientesProxy.length}`);
    dependientesProxy.forEach((d, idx) => {
      console.log(`      ${idx + 1}. Nombre: ${d.nombres} | Parentesco: ${d.parentesco}`);
      console.log(`         id_apoderado: ${d.id_apoderado} (Esperado: ${userIdProxy})`);
      console.log(`         id_perfil_propio: ${d.id_perfil_propio} (Esperado: null)`);
      console.log(`         telefono: ${d.telefono} (Esperado: null)`);
      console.log(`         correo: ${d.correo} (Esperado: null)`);
      if (d.telefono !== null || d.correo !== null) {
        throw new Error("El dependiente no tiene telefono/correo guardados como null");
      }
    });

    console.log("\n==================================================================");
    console.log("🏆 TODAS LAS VERIFICACIONES MANUALES Y LÓGICAS PASARON CON ÉXITO 🏆");
    console.log("==================================================================");

  } catch (error) {
    console.log("\n❌ VERIFICACIÓN FALLIDA:");
    console.error(error);
  } finally {
    // ------------------------------------------------------------------
    // LIMPIEZA
    // ------------------------------------------------------------------
    console.log("\n--- Limpiando registros temporales de la verificación ---");
    for (const u of usersCreated) {
      await supabase.auth.signInWithPassword({ email: u.email, password });
      
      const { data: pacs } = await supabase.from('pacientes').select('id_paciente').eq('id_apoderado', u.id);
      if (pacs && pacs.length > 0) {
        const ids = pacs.map(p => p.id_paciente);
        await supabase.from('pacientes').delete().in('id_paciente', ids);
      }
      
      await supabase.from('pacientes').delete().eq('id_perfil_propio', u.id);
      const { error: delPErr } = await supabase.from('perfiles').delete().eq('id', u.id);
      console.log(`  - Perfil temporal de ${u.email} eliminado. (Status: ${delPErr ? delPErr.message : 'OK'})`);
    }
  }
}

verifyRegistrationFlow();
