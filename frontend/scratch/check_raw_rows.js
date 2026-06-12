import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const tables = ['landing_personal', 'landing_testimonios', 'empleados', 'cargos', 'areas'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      console.log(`Table: ${t} -> Error: ${error.message}`);
    } else {
      console.log(`Table: ${t} -> Count: ${data ? data.length : 0}`);
      console.log(`Table: ${t} -> Raw Data:`, JSON.stringify(data, null, 2));
    }
  }
}

check();
