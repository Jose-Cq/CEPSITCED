import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log('--- 1. Querying Locales Anonymously ---');
  const { data: locAnon, error: errAnon } = await supabase.from('locales').select('*');
  if (errAnon) {
    console.error('Anon query error:', errAnon.message);
  } else {
    console.log('Anon query count:', locAnon ? locAnon.length : 0);
    console.log('Anon query data:', locAnon);
  }

  console.log('\n--- 2. Signing up and Authenticating ---');
  const email = `test-locales-${Date.now()}@sistema.cepsitced.local`;
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

  console.log('\n--- 3. Querying Locales as new Auth User ---');
  const { data: locAuth, error: errAuth } = await supabase.from('locales').select('*');
  if (errAuth) {
    console.error('Auth query error:', errAuth.message);
  } else {
    console.log('Auth query count:', locAuth ? locAuth.length : 0);
    console.log('Auth query data:', locAuth);
  }

  console.log('\n--- 4. Registering Profile & Patient ---');
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

  await supabase.from('pacientes').insert([{
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
  }]);
  console.log('Patient registered.');

  console.log('\n--- 5. Querying Locales as Patient ---');
  const { data: locPat, error: errPat } = await supabase.from('locales').select('*');
  if (errPat) {
    console.error('Patient query error:', errPat.message);
  } else {
    console.log('Patient query count:', locPat ? locPat.length : 0);
    console.log('Patient query data:', locPat);
  }

  console.log('\n--- 6. Querying Habitaciones as Patient ---');
  const { data: habPat, error: errHabPat } = await supabase
    .from('habitaciones')
    .select('*, locales(nombre)');
  if (errHabPat) {
    console.error('Habitaciones query error:', errHabPat.message);
  } else {
    console.log('Habitaciones query count:', habPat ? habPat.length : 0);
    console.log('Habitaciones query data:', habPat);
  }

  // Cleanup
  console.log('\n--- 7. Cleanup ---');
  await supabase.from('pacientes').delete().eq('id_perfil_propio', userId);
  await supabase.from('perfiles').delete().eq('id', userId);
  console.log('Cleanup finished.');
}

test();
