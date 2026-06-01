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

async function testQueryAll() {
  const email = `test-query-${Date.now()}@sistema.cepsitced.local`;
  const password = 'Password123!';

  console.log('1. Registering/signing in...');
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) {
    console.error('Sign up error:', authErr);
    return;
  }
  
  console.log('2. Querying all perfiles...');
  const { data: perfiles, error: perfErr } = await supabase.from('perfiles').select('*');
  console.log('Perfiles count:', perfiles ? perfiles.length : 0);
  console.log('Perfiles:', perfiles);

  console.log('3. Querying all pacientes...');
  const { data: pacientes, error: pacErr } = await supabase.from('pacientes').select('*');
  console.log('Pacientes count:', pacientes ? pacientes.length : 0);
  console.log('Pacientes:', pacientes);
}

testQueryAll();
