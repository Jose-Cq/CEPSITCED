import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  console.log('--- Signing up and Authenticating ---');
  const email = `test-rls-${Date.now()}@sistema.cepsitced.local`;
  const password = 'Password123!';
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
  if (authErr) {
    console.error('Sign up error:', authErr.message);
    return;
  }
  const userId = authData.user.id;
  await supabase.auth.signInWithPassword({ email, password });
  console.log('User signed in. ID:', userId);

  const tables = ['landing_personal', 'landing_testimonios', 'empleados', 'cargos', 'areas'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      console.log(`Table: ${t} -> Error: ${error.message}`);
    } else {
      console.log(`Table: ${t} -> Count: ${data ? data.length : 0}`);
      console.log(`Table: ${t} -> Data:`, JSON.stringify(data, null, 2));
    }
  }

  // Cleanup
  console.log('--- Cleaning up user profile ---');
  // Just delete auth user (or it will remain, which is fine for test, but let's delete if perfiles/pacientes isn't created)
}

check();
