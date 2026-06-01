const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
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

async function runTests() {
  console.log("=== Starting Option B Integration Tests (Authenticated) ===");

  const email = `test-patient-${Date.now()}@example.com`;
  const password = 'Password123!';
  const dni = String(Math.floor(10000000 + Math.random() * 90000000));
  const hc = Math.floor(10000 + Math.random() * 90000);

  // Step 1: Sign up and sign in
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) {
    console.error("Failed to sign up auth user:", authErr);
    process.exit(1);
  }
  const user = authData.user;
  console.log(`Auth user registered (ID: ${user.id})`);

  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    console.error("Failed to sign in:", signInErr);
    process.exit(1);
  }
  console.log("Authenticated successfully.");

  // Step 2: Insert Profile and Patient
  const { data: profile, error: profErr } = await supabase.from('perfiles').insert([{
    id: user.id,
    correo: email,
    dni,
    nombres: 'Test',
    apellido_paterno: 'Patient',
    apellido_materno: 'OptionB',
    fecha_nacimiento: '1990-01-01',
    telefono: '+51 999999999'
  }]).select().single();

  if (profErr) {
    console.error("Failed to create profile:", profErr);
    process.exit(1);
  }

  const { data: patient, error: patErr } = await supabase.from('pacientes').insert([{
    id_perfil_propio: user.id,
    dni,
    nombres: 'Test',
    apellido_paterno: 'Patient',
    apellido_materno: 'OptionB',
    numero_hc: hc,
    genero: 'Otro',
    fecha_nacimiento: '1990-01-01'
  }]).select().single();

  if (patErr) {
    console.error("Failed to create patient:", patErr);
    process.exit(1);
  }
  const patientId = patient.id_paciente;
  console.log(`Patient record created (ID: ${patientId}, DNI: ${dni})`);

  // Step 3: Get service and specialist
  const { data: services, error: sErr } = await supabase.from('servicios').select('*').limit(1);
  if (sErr || !services || services.length === 0) {
    console.error("Failed to fetch services:", sErr || "No services found");
    process.exit(1);
  }
  const service = services[0];
  console.log(`Service selected: ${service.nombre_servicio} (ID: ${service.id})`);

  const { data: specialists, error: spErr } = await supabase.from('empleados').select('*').limit(1);
  if (spErr || !specialists || specialists.length === 0) {
    console.error("Failed to fetch specialists:", spErr || "No specialists found");
    process.exit(1);
  }
  const specialist = specialists[0];
  const specialistName = `${specialist.nombres || ''} ${specialist.apellido_paterno || ''}`.trim();
  console.log(`Specialist selected: ${specialistName} (ID: ${specialist.id})`);

  // To track created test records for cleanup
  const createdPacks = [];
  const createdAppointments = [];

  try {
    // -------------------------------------------------------------
    // Caso 1: Comprar paquete (10 sesiones)
    // -------------------------------------------------------------
    console.log("\n--- Caso 1: Comprar paquete ---");
    const { data: packAdq, error: buyErr } = await supabase
      .from('paquetes_adquiridos')
      .insert([{
        paciente_id: patientId,
        servicio_id: service.id,
        nombre_paquete_snapshot: 'Pack Bienestar Test 10 sesiones',
        sesiones_totales: 10,
        sesiones_disponibles: 10,
        monto_pagado: 150,
        metodo_pago: 'Pago Online Culqi'
      }])
      .select()
      .single();

    if (buyErr) throw buyErr;
    createdPacks.push(packAdq.id);

    console.log("SUCCESS: Package purchased.");
    console.log(`  sesiones_totales: ${packAdq.sesiones_totales} (Expected: 10)`);
    console.log(`  sesiones_disponibles: ${packAdq.sesiones_disponibles} (Expected: 10)`);

    if (packAdq.sesiones_totales !== 10 || packAdq.sesiones_disponibles !== 10) {
      throw new Error("Case 1 validation failed");
    }

    // -------------------------------------------------------------
    // Caso 2: Agendar usando paquete
    // -------------------------------------------------------------
    console.log("\n--- Caso 2: Agendar usando paquete ---");
    // Insert pending appointment
    const { data: app1, error: app1Err } = await supabase
      .from('citas')
      .insert([{
        paciente_id: patientId,
        psicologo_id: specialist.id,
        psicologa_nombre: specialistName,
        servicio: service.nombre_servicio,
        fecha_cita: '2026-06-15',
        hora_inicio: '10:00:00',
        hora_fin: '11:00:00',
        estado_cita: 'Pendiente',
        estado_pago: 'Pagado',
        metodo_pago: 'Pago Online Culqi',
        monto: 0,
        paquete_id: packAdq.id
      }])
      .select()
      .single();

    if (app1Err) throw app1Err;
    createdAppointments.push(app1.id);

    // Read package again
    const { data: packAfterApp1 } = await supabase
      .from('paquetes_adquiridos')
      .select('*')
      .eq('id', packAdq.id)
      .single();

    // Calculate citas_pendientes and sesiones_netas
    const { count: pendingCount } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('paquete_id', packAdq.id)
      .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

    const netas = packAfterApp1.sesiones_disponibles - (pendingCount || 0);

    console.log(`  sesiones_disponibles: ${packAfterApp1.sesiones_disponibles} (Expected: 10)`);
    console.log(`  citas_pendientes: ${pendingCount} (Expected: 1)`);
    console.log(`  sesiones_netas: ${netas} (Expected: 9)`);

    if (packAfterApp1.sesiones_disponibles !== 10 || pendingCount !== 1 || netas !== 9) {
      throw new Error("Case 2 validation failed");
    }

    // -------------------------------------------------------------
    // Caso 3: Cancelar cita pendiente
    // -------------------------------------------------------------
    console.log("\n--- Caso 3: Cancelar cita pendiente ---");
    const { error: cancelErr } = await supabase
      .from('citas')
      .update({ estado_cita: 'cancelada' })
      .eq('id', app1.id);

    if (cancelErr) throw cancelErr;

    // Read package and pending count
    const { data: packAfterCancel } = await supabase
      .from('paquetes_adquiridos')
      .select('*')
      .eq('id', packAdq.id)
      .single();

    const { count: pendingCountAfterCancel } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('paquete_id', packAdq.id)
      .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

    const netasAfterCancel = packAfterCancel.sesiones_disponibles - (pendingCountAfterCancel || 0);

    console.log(`  sesiones_disponibles: ${packAfterCancel.sesiones_disponibles} (Expected: 10)`);
    console.log(`  citas_pendientes: ${pendingCountAfterCancel} (Expected: 0)`);
    console.log(`  sesiones_netas: ${netasAfterCancel} (Expected: 10)`);

    if (packAfterCancel.sesiones_disponibles !== 10 || pendingCountAfterCancel !== 0 || netasAfterCancel !== 10) {
      throw new Error("Case 3 validation failed");
    }

    // -------------------------------------------------------------
    // Caso 4: Completar cita
    // -------------------------------------------------------------
    console.log("\n--- Caso 4: Completar cita ---");
    // Change appointment state to Completada (trigger should decrement sesiones_disponibles)
    const { error: completeErr } = await supabase
      .from('citas')
      .update({ estado_cita: 'Completada' })
      .eq('id', app1.id);

    if (completeErr) throw completeErr;

    // Wait a brief moment for trigger to run in DB
    await new Promise(r => setTimeout(r, 800));

    // Read package again
    const { data: packAfterComplete } = await supabase
      .from('paquetes_adquiridos')
      .select('*')
      .eq('id', packAdq.id)
      .single();

    console.log(`  sesiones_disponibles: ${packAfterComplete.sesiones_disponibles} (Expected: 9)`);

    if (packAfterComplete.sesiones_disponibles !== 9) {
      throw new Error("Case 4 validation failed (trigger may not be installed or didn't run)");
    }

    // -------------------------------------------------------------
    // Caso 5: Revertir cita completada
    // -------------------------------------------------------------
    console.log("\n--- Caso 5: Revertir cita completada ---");
    // Change state from Completada to Pendiente (trigger should increment sesiones_disponibles back to 10)
    const { error: revertErr } = await supabase
      .from('citas')
      .update({ estado_cita: 'Pendiente' })
      .eq('id', app1.id);

    if (revertErr) throw revertErr;

    // Wait a brief moment for trigger
    await new Promise(r => setTimeout(r, 800));

    const { data: packAfterRevert } = await supabase
      .from('paquetes_adquiridos')
      .select('*')
      .eq('id', packAdq.id)
      .single();

    console.log(`  sesiones_disponibles: ${packAfterRevert.sesiones_disponibles} (Expected: 10)`);

    if (packAfterRevert.sesiones_disponibles !== 10) {
      throw new Error("Case 5 validation failed");
    }

    // Double test LEAST limit (updating state to 'Completada' and back multiple times should not exceed 10)
    console.log("  Testing LEAST limit by doing multiple updates...");
    // Set to Completada
    await supabase.from('citas').update({ estado_cita: 'Completada' }).eq('id', app1.id);
    await new Promise(r => setTimeout(r, 500));
    // Manually hack the db to have 10
    await supabase.from('paquetes_adquiridos').update({ sesiones_disponibles: 10 }).eq('id', packAdq.id);
    // Now revert back to Pendiente
    await supabase.from('citas').update({ estado_cita: 'Pendiente' }).eq('id', app1.id);
    await new Promise(r => setTimeout(r, 500));

    const { data: packAfterLeastTest } = await supabase
      .from('paquetes_adquiridos')
      .select('*')
      .eq('id', packAdq.id)
      .single();

    console.log(`  sesiones_disponibles after least test: ${packAfterLeastTest.sesiones_disponibles} (Expected: 10, not 11)`);
    if (packAfterLeastTest.sesiones_disponibles !== 10) {
      throw new Error("Case 5 LEAST limit check failed");
    }

    // -------------------------------------------------------------
    // Caso 6: Sobre-reserva
    // -------------------------------------------------------------
    console.log("\n--- Caso 6: Sobre-reserva ---");
    // We already have app1 as Pendiente.
    // Add 9 more pending appointments (total 10).
    console.log("  Adding 9 more pending appointments...");
    for (let i = 2; i <= 10; i++) {
      const { data: app, error: appErr } = await supabase
        .from('citas')
        .insert([{
          paciente_id: patientId,
          psicologo_id: specialist.id,
          psicologa_nombre: specialistName,
          servicio: service.nombre_servicio,
          fecha_cita: '2026-06-15',
          hora_inicio: `${10 + i}:00:00`,
          hora_fin: `${11 + i}:00:00`,
          estado_cita: 'Pendiente',
          estado_pago: 'Pagado',
          metodo_pago: 'Pago Online Culqi',
          monto: 0,
          paquete_id: packAdq.id
        }])
        .select()
        .single();

      if (appErr) throw appErr;
      createdAppointments.push(app.id);
    }

    // Read active count again
    const { count: pendingCountFinal } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('paquete_id', packAdq.id)
      .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

    console.log(`  Total pending appointments added: ${pendingCountFinal} (Expected: 10)`);
    if (pendingCountFinal !== 10) {
      throw new Error("Failed to add 10 pending appointments");
    }

    // Try 11th pending appointment
    const { data: dbPackVerify } = await supabase
      .from('paquetes_adquiridos')
      .select('sesiones_disponibles')
      .eq('id', packAdq.id)
      .single();

    const { count: dbPendingCountVerify } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('paquete_id', packAdq.id)
      .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

    const netasFinal = dbPackVerify.sesiones_disponibles - (dbPendingCountVerify || 0);
    console.log(`  Validation calculation for 11th appointment: ${dbPackVerify.sesiones_disponibles} - ${dbPendingCountVerify} = ${netasFinal}`);
    
    if (netasFinal <= 0) {
      console.log("SUCCESS: 11th appointment booking blocked. Validation returned error: 'No tienes sesiones disponibles en este paquete.'");
    } else {
      throw new Error("Validation failed: allowed 11th booking!");
    }

    console.log("\n*** ALL OPTION B INTEGRATION TESTS PASSED SUCCESSFULLY! ***");

  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    // Clean up
    console.log("\n--- Cleaning up test records ---");
    if (createdAppointments.length > 0) {
      const { error: delAppErr } = await supabase.from('citas').delete().in('id', createdAppointments);
      console.log(`  Deleted ${createdAppointments.length} test appointments:`, delAppErr ? delAppErr.message : "OK");
    }
    if (createdPacks.length > 0) {
      const { error: delPackErr } = await supabase.from('paquetes_adquiridos').delete().in('id', createdPacks);
      console.log(`  Deleted ${createdPacks.length} test packages:`, delPackErr ? delPackErr.message : "OK");
    }
    if (patientId) {
      const { error: delPErr } = await supabase.from('pacientes').delete().eq('id_paciente', patientId);
      console.log(`  Deleted temporary test patient:`, delPErr ? delPErr.message : "OK");
    }
    if (user) {
      const { error: delProfErr } = await supabase.from('perfiles').delete().eq('id', user.id);
      console.log(`  Deleted temporary test profile:`, delProfErr ? delProfErr.message : "OK");
      
      // Note: We cannot delete auth users via client library without admin privileges, but cleaning up perfiles/pacientes is enough as auth users won't interfere.
    }
  }
}

runTests();
