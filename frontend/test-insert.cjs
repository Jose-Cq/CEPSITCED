const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
  const email = `test-user-${Date.now()}@example.com`;
  const password = 'Password123!';
  const dni = String(Math.floor(10000000 + Math.random() * 90000000));
  const hc = String(Math.floor(1000 + Math.random() * 9000)) + '050626M';

  console.log('1. Signing up user...');
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) {
    console.error('Sign up error:', authErr);
    return;
  }
  const userId = authData.user.id;
  console.log('User created:', userId);

  console.log('2. Inserting profile...');
  const { data: prof, error: profErr } = await supabase.from('perfiles').insert([{
    id: userId,
    dni,
    nombres: 'Test',
    apellido_paterno: 'Patient',
    apellido_materno: 'OptionB',
    fecha_nacimiento: '1990-01-01',
    telefono: '+51 999888777',
    correo: email
  }]).select().single();

  if (profErr) {
    console.error('Profile insertion error:', profErr);
    return;
  }
  console.log('Profile inserted:', prof);

  console.log('3. Inserting patient (with all fields from RegisterModal)...');
  const patientData = {
    numero_hc: hc,
    dni,
    genero: 'Masculino',
    fecha_nacimiento: '1990-01-01',
    lugar_familia: 'Hijo único/a',
    estado_civil: 'Soltero/a',
    grado_instruccion: 'Superior Completa',
    ocupacion: 'Estudiante',
    direccion: 'Av. Test 123',
    telefono: '+51 999888777',
    correo: email,
    nombres: 'Test',
    apellido_paterno: 'Patient',
    apellido_materno: 'OptionB',
    pais: 'Perú',
    departamento: 'Lima',
    provincia: 'Lima',
    distrito: 'Lima',
    estado_cuenta: 'INDEPENDIENTE',
    id_perfil_propio: userId,
    id_apoderado: null,
    parentesco: null
  };

  const { data: pat, error: patErr } = await supabase.from('pacientes').insert([patientData]).select();
  if (patErr) {
    console.error('Patient insertion error:', patErr);
  } else {
    console.log('Patient inserted successfully:', pat);
  }
}

testInsert();
