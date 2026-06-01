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

async function check() {
  console.log('Querying perfiles...');
  const { data: perfiles, error: perfErr } = await supabase.from('perfiles').select('*').limit(10);
  if (perfErr) console.error('Error perfiles:', perfErr);
  else console.log('Perfiles:', perfiles);

  console.log('Querying pacientes...');
  const { data: pacientes, error: pacErr } = await supabase.from('pacientes').select('*').limit(10);
  if (pacErr) console.error('Error pacientes:', pacErr);
  else console.log('Pacientes:', pacientes);
}

check();
