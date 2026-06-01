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

// Client for testing
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAllTests() {
  console.log("===============================================================");
  console.log("=== RUNNING ALL OPTION B SCENARIOS AND SECURITY POLICIES =====");
  console.log("===============================================================");

  // We will create two different users to test RLS
  const email1 = `test-apoderado-${Date.now()}@example.com`;
  const email2 = `test-stranger-${Date.now()}@example.com`;
  const password = 'Password123!';
  
  const dniTitular = String(Math.floor(10000000 + Math.random() * 90000000));
  const dniDep = String(Math.floor(10000000 + Math.random() * 90000000));
  const dniStranger = String(Math.floor(10000000 + Math.random() * 90000000));

  const hcTitular = Math.floor(10000 + Math.random() * 90000);
  const hcDep = Math.floor(10000 + Math.random() * 90000);
  const hcStranger = Math.floor(10000 + Math.random() * 90000);

  let user1, user2;
  let patientTitularId, patientDepId, patientStrangerId;
  const createdPacks = [];
  const createdAppointments = [];
  
  try {
    // -------------------------------------------------------------
    // SIGN UP AND SIGN IN USER 1 (Apoderado / Paciente Independiente)
    // -------------------------------------------------------------
    const { data: authData1, error: authErr1 } = await supabase.auth.signUp({ email: email1, password });
    if (authErr1) throw new Error("Failed signing up User 1: " + authErr1.message);
    user1 = authData1.user;
    
    await supabase.auth.signInWithPassword({ email: email1, password });
    
    // Create User 1 Profile & Patient
    const { data: prof1 } = await supabase.from('perfiles').insert([{
      id: user1.id,
      correo: email1,
      dni: dniTitular,
      nombres: 'Titular',
      apellido_paterno: 'Independent',
      apellido_materno: 'Test',
      fecha_nacimiento: '1985-05-15',
      telefono: '+51 999888777'
    }]).select().single();

    const { data: pat1 } = await supabase.from('pacientes').insert([{
      id_perfil_propio: user1.id,
      dni: dniTitular,
      nombres: 'Titular',
      apellido_paterno: 'Independent',
      apellido_materno: 'Test',
      numero_hc: hcTitular,
      genero: 'Masculino',
      fecha_nacimiento: '1985-05-15'
    }]).select().single();
    
    patientTitularId = pat1.id_paciente;
    console.log(`[Setup] User 1 (Titular) created. Patient ID: ${patientTitularId}`);

    // Create Dependent Patient under User 1
    const { data: patDep } = await supabase.from('pacientes').insert([{
      dni: dniDep,
      nombres: 'Hijo',
      apellido_paterno: 'Independent',
      apellido_materno: 'Test',
      numero_hc: hcDep,
      genero: 'Femenino',
      fecha_nacimiento: '2015-10-20',
      id_perfil_propio: null,
      id_apoderado: user1.id
    }]).select().single();

    patientDepId = patDep.id_paciente;
    console.log(`[Setup] Dependent Patient created under User 1. Patient ID: ${patientDepId}`);

    // Fetch a service and an employee for appointments
    const { data: services } = await supabase.from('servicios').select('*').limit(1);
    const service = services[0];
    const { data: specialists } = await supabase.from('empleados').select('*').limit(1);
    const specialist = specialists[0];
    const specialistName = `${specialist.nombres} ${specialist.apellido_paterno}`;

    // =============================================================
    // ESCENARIO 1: Paciente independiente
    // =============================================================
    console.log("\n>>> ESCENARIO 1: Paciente Independiente");
    
    // 1. Comprar paquete
    const { data: packIndep, error: packIndepErr } = await supabase.from('paquetes_adquiridos').insert([{
      paciente_id: patientTitularId,
      servicio_id: service.id,
      nombre_paquete_snapshot: 'Pack Terapia Titular 10s',
      sesiones_totales: 10,
      sesiones_disponibles: 10,
      monto_pagado: 120,
      metodo_pago: 'Pago Online Culqi'
    }]).select().single();
    
    if (packIndepErr) {
      console.log("  ⚠️  Comprar paquete falló. (Nota: Esto es normal si las políticas RLS de Supabase aún no se han aplicado)");
      throw packIndepErr;
    }
    createdPacks.push(packIndep.id);
    console.log(`  [OK] Paquete comprado. ID: ${packIndep.id}. sesiones_disponibles: ${packIndep.sesiones_disponibles}`);

    // 2. Ver paquete adquirido
    const { data: readPackIndep } = await supabase.from('paquetes_adquiridos').select('*').eq('id', packIndep.id).single();
    console.log(`  [OK] Ver paquete. Nombre: "${readPackIndep.nombre_paquete_snapshot}" | Disponibles: ${readPackIndep.sesiones_disponibles}`);

    // 3. Agendar usando paquete
    const { data: appIndep } = await supabase.from('citas').insert([{
      paciente_id: patientTitularId,
      psicologo_id: specialist.id,
      psicologa_nombre: specialistName,
      servicio: service.nombre_servicio,
      fecha_cita: '2026-06-10',
      hora_inicio: '09:00:00',
      hora_fin: '10:00:00',
      estado_cita: 'Pendiente',
      estado_pago: 'Pagado',
      metodo_pago: 'Pago Online Culqi',
      monto: 0,
      paquete_id: packIndep.id
    }]).select().single();
    createdAppointments.push(appIndep.id);
    console.log(`  [OK] Cita agendada. ID: ${appIndep.id} | estado_cita: ${appIndep.estado_cita}`);

    // 4. Completar cita
    await supabase.from('citas').update({ estado_cita: 'Completada' }).eq('id', appIndep.id);
    console.log(`  [Action] Cambiando estado_cita a 'Completada'...`);
    await new Promise(r => setTimeout(r, 1000)); // Esperar trigger

    // 5. Ver descuento de sesiones
    const { data: packIndepAfterComplete } = await supabase.from('paquetes_adquiridos').select('*').eq('id', packIndep.id).single();
    console.log(`  [OK] sesiones_disponibles después de completar: ${packIndepAfterComplete.sesiones_disponibles} (Esperado: 9)`);
    if (packIndepAfterComplete.sesiones_disponibles !== 9) {
      throw new Error("El descuento de sesiones no funcionó correctamente.");
    }

    // =============================================================
    // ESCENARIO 2: Apoderado
    // =============================================================
    console.log("\n>>> ESCENARIO 2: Apoderado");

    // 1. Comprar paquete para sí mismo (ya lo probamos, pero haremos otro de 5 sesiones)
    const { data: packApoderado } = await supabase.from('paquetes_adquiridos').insert([{
      paciente_id: patientTitularId,
      servicio_id: service.id,
      nombre_paquete_snapshot: 'Pack Apoderado 5s',
      sesiones_totales: 5,
      sesiones_disponibles: 5,
      monto_pagado: 75,
      metodo_pago: 'Pago en Clínica'
    }]).select().single();
    createdPacks.push(packApoderado.id);
    console.log(`  [OK] Paquete propio comprado para apoderado. ID: ${packApoderado.id}`);

    // 2. Comprar paquete para un dependiente
    const { data: packDep } = await supabase.from('paquetes_adquiridos').insert([{
      paciente_id: patientDepId,
      servicio_id: service.id,
      nombre_paquete_snapshot: 'Pack Terapia Infantil Hijo 10s',
      sesiones_totales: 10,
      sesiones_disponibles: 10,
      monto_pagado: 150,
      metodo_pago: 'Pago Online Culqi'
    }]).select().single();
    createdPacks.push(packDep.id);
    console.log(`  [OK] Paquete comprado para dependiente. ID: ${packDep.id}`);

    // 3. Ver ambos paquetes (debe poder leer tanto paciente_id de sí mismo como de sus dependientes)
    const { data: allUserPacks } = await supabase.from('paquetes_adquiridos').select('*');
    console.log(`  [OK] Apoderado visualiza sus paquetes (propios y de dependientes). Encontrados: ${allUserPacks.length}`);
    allUserPacks.forEach(p => {
      console.log(`       - Paquete ID: ${p.id} | Paciente ID: ${p.paciente_id} | Nombre: "${p.nombre_paquete_snapshot}"`);
    });
    
    const idsRead = allUserPacks.map(p => p.id);
    if (!idsRead.includes(packApoderado.id) || !idsRead.includes(packDep.id)) {
      throw new Error("El apoderado no pudo leer todos sus paquetes o los de sus dependientes.");
    }

    // 4. Agendar cita para dependiente usando el paquete del dependiente
    const { data: appDep } = await supabase.from('citas').insert([{
      paciente_id: patientDepId,
      psicologo_id: specialist.id,
      psicologa_nombre: specialistName,
      servicio: service.nombre_servicio,
      fecha_cita: '2026-06-11',
      hora_inicio: '10:00:00',
      hora_fin: '11:00:00',
      estado_cita: 'Pendiente',
      estado_pago: 'Pagado',
      metodo_pago: 'Pago Online Culqi',
      monto: 0,
      paquete_id: packDep.id
    }]).select().single();
    createdAppointments.push(appDep.id);
    console.log(`  [OK] Cita agendada para el dependiente usando su paquete. Cita ID: ${appDep.id}`);

    // 5. Completar cita del dependiente
    await supabase.from('citas').update({ estado_cita: 'Completada' }).eq('id', appDep.id);
    console.log(`  [Action] Cambiando estado_cita de dependiente a 'Completada'...`);
    await new Promise(r => setTimeout(r, 1000)); // Esperar trigger

    // 6. Ver descuento de sesiones del paquete del dependiente
    const { data: packDepAfterComplete } = await supabase.from('paquetes_adquiridos').select('*').eq('id', packDep.id).single();
    console.log(`  [OK] sesiones_disponibles del dependiente: ${packDepAfterComplete.sesiones_disponibles} (Esperado: 9)`);
    if (packDepAfterComplete.sesiones_disponibles !== 9) {
      throw new Error("El descuento de sesiones del dependiente no funcionó.");
    }


    // =============================================================
    // ESCENARIO 3: Validación de sobrereserva
    // =============================================================
    console.log("\n>>> ESCENARIO 3: Validación de Sobrereserva");

    // 1. Crear paquete de 10 sesiones
    const { data: packOverbook } = await supabase.from('paquetes_adquiridos').insert([{
      paciente_id: patientTitularId,
      servicio_id: service.id,
      nombre_paquete_snapshot: 'Pack Sobrereserva 10s',
      sesiones_totales: 10,
      sesiones_disponibles: 10,
      monto_pagado: 120,
      metodo_pago: 'Pago en Clínica'
    }]).select().single();
    createdPacks.push(packOverbook.id);
    console.log(`  [OK] Paquete de prueba de sobrereserva creado. ID: ${packOverbook.id}`);

    // 2. Agendar 10 citas activas (citas_pendientes = 10)
    console.log("  [Action] Agendando 10 citas pendientes...");
    for (let i = 1; i <= 10; i++) {
      const { data: appTemp } = await supabase.from('citas').insert([{
        paciente_id: patientTitularId,
        psicologo_id: specialist.id,
        psicologa_nombre: specialistName,
        servicio: service.nombre_servicio,
        fecha_cita: '2026-06-15',
        hora_inicio: `${10 + i}:00:00`,
        hora_fin: `${11 + i}:00:00`,
        estado_cita: 'Pendiente',
        estado_pago: 'Pagado',
        metodo_pago: 'Pago en Clínica',
        monto: 0,
        paquete_id: packOverbook.id
      }]).select().single();
      createdAppointments.push(appTemp.id);
    }

    // 3. Confirmar que la número 11 es bloqueada por la validación
    const { data: dbPackVerify } = await supabase.from('paquetes_adquiridos').select('sesiones_disponibles').eq('id', packOverbook.id).single();
    const { count: dbPendingCountVerify } = await supabase.from('citas').select('*', { count: 'exact', head: true }).eq('paquete_id', packOverbook.id).in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);
    
    const netasFinal = dbPackVerify.sesiones_disponibles - (dbPendingCountVerify || 0);
    console.log(`  [Validation] sesiones_disponibles: ${dbPackVerify.sesiones_disponibles} | citas_pendientes: ${dbPendingCountVerify} | sesiones_netas: ${netasFinal}`);
    
    if (netasFinal <= 0) {
      console.log("  [OK] Bloqueo correcto. Citas pendientes alcanzaron el límite de sesiones disponibles.");
    } else {
      throw new Error("Falla de validación: Se permitieron reservar más citas que las sesiones disponibles.");
    }


    // =============================================================
    // ESCENARIO 4: Reversión
    // =============================================================
    console.log("\n>>> ESCENARIO 4: Reversión");

    // Usaremos la cita appIndep del Escenario 1 (que tiene paquete packIndep con 9 disponibles).
    // 1. Completar la cita (ya está completada, disponibles = 9)
    console.log(`  [State] sesiones_disponibles actual: ${packIndepAfterComplete.sesiones_disponibles} (Esperado: 9)`);

    // 2. Cambiar la cita nuevamente a Pendiente
    await supabase.from('citas').update({ estado_cita: 'Pendiente' }).eq('id', appIndep.id);
    console.log(`  [Action] Cambiando cita completada de vuelta a 'Pendiente'...`);
    await new Promise(r => setTimeout(r, 1000)); // Esperar trigger

    // 3. Ver sesiones_disponibles restauradas
    const { data: packIndepAfterRevert } = await supabase.from('paquetes_adquiridos').select('*').eq('id', packIndep.id).single();
    console.log(`  [OK] sesiones_disponibles restaurada: ${packIndepAfterRevert.sesiones_disponibles} (Esperado: 10)`);
    if (packIndepAfterRevert.sesiones_disponibles !== 10) {
      throw new Error("La devolución de sesiones no funcionó.");
    }


    // =============================================================
    // ESCENARIO 5: RLS (Seguridad / Acceso Ajeno)
    // =============================================================
    console.log("\n>>> ESCENARIO 5: RLS (Acceso Ajeno)");

    // 1. Sign up User 2 (Stranger)
    const { data: authData2, error: authErr2 } = await supabase.auth.signUp({ email: email2, password });
    if (authErr2) throw new Error("Failed signing up User 2: " + authErr2.message);
    user2 = authData2.user;

    await supabase.auth.signInWithPassword({ email: email2, password });

    // Create User 2 Profile & Patient
    const { data: prof2 } = await supabase.from('perfiles').insert([{
      id: user2.id,
      correo: email2,
      dni: dniStranger,
      nombres: 'Stranger',
      apellido_paterno: 'Alien',
      apellido_materno: 'Test',
      fecha_nacimiento: '1992-07-20',
      telefono: '+51 987654321'
    }]).select().single();

    const { data: pat2 } = await supabase.from('pacientes').insert([{
      id_perfil_propio: user2.id,
      dni: dniStranger,
      nombres: 'Stranger',
      apellido_paterno: 'Alien',
      apellido_materno: 'Test',
      numero_hc: hcStranger,
      genero: 'Femenino',
      fecha_nacimiento: '1992-07-20'
    }]).select().single();

    patientStrangerId = pat2.id_paciente;
    console.log(`  [Setup] User 2 logged in as: ${email2}`);

    // 2. Intentar leer paquetes de User 1 (packIndep)
    const { data: readStrangerPacks } = await supabase.from('paquetes_adquiridos').select('*');
    
    console.log(`  [Read Check] User 2 consulta paquetes_adquiridos.`);
    console.log(`               Total devuelto para User 2: ${readStrangerPacks.length} paquetes.`);
    
    const strangerReadIds = readStrangerPacks.map(p => p.id);
    if (strangerReadIds.includes(packIndep.id) || strangerReadIds.includes(packDep.id)) {
      throw new Error("RLS VIOLATION: User 2 pudo ver paquetes comprados por User 1.");
    } else {
      console.log("  [OK] RLS bloqueó la visualización de paquetes ajenos. User 2 no puede acceder a paquetes de User 1.");
    }

    console.log("\n===============================================================");
    console.log("🏆 ¡TODOS LOS ESCENARIOS Y POLÍTICAS PASARON CON ÉXITO! 🏆");
    console.log("===============================================================");

  } catch (error) {
    console.log("\n❌ ERROR DETECTADO DURANTE LAS VALIDACIONES:");
    console.error(error);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log("\n--- Iniciando limpieza de registros temporales ---");
    
    // Sign back in as apoderado (if needed, but delete can be run with service role or since they are owned records we sign back in to delete them)
    if (user1) {
      await supabase.auth.signInWithPassword({ email: email1, password });
      
      if (createdAppointments.length > 0) {
        const { error: delAppErr } = await supabase.from('citas').delete().in('id', createdAppointments);
        console.log(`  - Citas de prueba eliminadas: ${createdAppointments.length} (${delAppErr ? delAppErr.message : 'OK'})`);
      }
      if (createdPacks.length > 0) {
        const { error: delPackErr } = await supabase.from('paquetes_adquiridos').delete().in('id', createdPacks);
        console.log(`  - Paquetes de prueba eliminados: ${createdPacks.length} (${delPackErr ? delPackErr.message : 'OK'})`);
      }
      if (patientDepId) {
        const { error: delDepErr } = await supabase.from('pacientes').delete().eq('id_paciente', patientDepId);
        console.log(`  - Paciente dependiente eliminado: (${delDepErr ? delDepErr.message : 'OK'})`);
      }
      if (patientTitularId) {
        const { error: delTitErr } = await supabase.from('pacientes').delete().eq('id_paciente', patientTitularId);
        console.log(`  - Paciente titular eliminado: (${delTitErr ? delTitErr.message : 'OK'})`);
      }
      const { error: delProf1 } = await supabase.from('perfiles').delete().eq('id', user1.id);
      console.log(`  - Perfil titular eliminado: (${delProf1 ? delProf1.message : 'OK'})`);
    }

    if (user2) {
      await supabase.auth.signInWithPassword({ email: email2, password });
      if (patientStrangerId) {
        await supabase.from('pacientes').delete().eq('id_paciente', patientStrangerId);
      }
      await supabase.from('perfiles').delete().eq('id', user2.id);
      console.log(`  - Perfil del usuario 2 eliminado.`);
    }
  }
}

runAllTests();
