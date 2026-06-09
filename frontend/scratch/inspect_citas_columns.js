import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log('\n--- Signing up and Authenticating ---');
  const email = `test-citas-${Date.now()}@sistema.cepsitced.local`;
  const password = 'Password123!';
  const dni = String(Math.floor(10000000 + Math.random() * 90000000));
  const hc = String(Math.floor(1000 + Math.random() * 9000)) + '050626M';

  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) {
    console.error('Sign up error:', authErr.message);
    return;
  }
  const userId = authData.user.id;
  await supabase.auth.signInWithPassword({ email, password });
  console.log('User signed in. ID:', userId);

  console.log('\n--- Fetching an active employee ID ---');
  const { data: employees, error: empErr } = await supabase.from('empleados').select('id, nombres').eq('activo', true).limit(1);
  if (empErr || !employees || employees.length === 0) {
    console.error('Failed to get active employee:', empErr?.message || 'None found');
    return;
  }
  const employeeId = employees[0].id;
  console.log('Found employee:', employees[0].nombres, 'ID:', employeeId);

  console.log('\n--- Registering Profile & Patient ---');
  await supabase.from('perfiles').insert([{
    id: userId,
    dni,
    nombres: 'Test',
    apellido_paterno: 'Patient',
    apellido_materno: 'OptionB',
    fecha_nacimiento: '1990-01-01',
    telefono: '+51 999888777',
    correo: email
  }]);

  const { data: pData, error: pErr } = await supabase.from('pacientes').insert([{
    numero_hc: hc,
    dni,
    genero: 'Masculino',
    fecha_nacimiento: '1990-01-01',
    direccion: 'Av. Test 123',
    nombres: 'Test',
    apellido_paterno: 'Patient',
    apellido_materno: 'OptionB',
    pais: 'Perú',
    id_perfil_propio: userId,
    estado_cuenta: 'INDEPENDIENTE'
  }]).select().single();

  if (pErr) {
    console.error('Error creating patient:', pErr.message);
    return;
  }

  const pacienteId = pData.id_paciente;
  console.log('Patient registered. ID:', pacienteId);

  console.log('\n--- Testing Cita Insertion with Pago Online ---');
  const tempCita = {
    paciente_id: pacienteId,
    psicologo_id: employeeId,
    psicologa_nombre: employees[0].nombres,
    servicio: 'Terapia Individual',
    numero_sesion: 1,
    fecha_cita: '2026-06-15',
    hora_inicio: '10:00:00',
    hora_fin: '10:50:00',
    estado_cita: 'Pendiente',
    estado_pago: 'Pendiente',
    metodo_pago: 'Pago Online',
    monto: 80,
    comentario_paciente: 'Test',
    modalidad: 'Virtual'
  };

  const { data: insertCita, error: insertErr } = await supabase
    .from('citas')
    .insert([tempCita])
    .select();

  if (insertErr) {
    console.error('Failed to insert cita with "Pago Online":', insertErr.message);
    console.log('Trying with "Pago Online Culqi"...');
    const { data: insertCita2, error: insertErr2 } = await supabase
      .from('citas')
      .insert([{ ...tempCita, metodo_pago: 'Pago Online Culqi' }])
      .select();
    if (insertErr2) {
      console.error('Failed with "Pago Online Culqi" too:', insertErr2.message);
    } else {
      console.log('Success with "Pago Online Culqi"!', insertCita2);
    }
  } else {
    console.log('Success with "Pago Online"!', insertCita);
  }

  // Cleanup
  console.log('\n--- Cleanup ---');
  if (insertCita && insertCita.length > 0) {
    await supabase.from('citas').delete().eq('id', insertCita[0].id);
  }
  await supabase.from('pacientes').delete().eq('id_perfil_propio', userId);
  await supabase.from('perfiles').delete().eq('id', userId);
  console.log('Cleanup finished.');
}

test();
