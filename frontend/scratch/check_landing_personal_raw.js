import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data: personal } = await supabase.from('landing_personal').select('*');
  console.log('landing_personal Row:', personal ? personal[0] : 'None');

  if (personal && personal.length > 0) {
    const empId = personal[0].empleado_id;
    console.log('Searching for employee with ID:', empId);
    const { data: emp } = await supabase.from('empleados').select('*').eq('id', empId);
    console.log('Employee found:', emp);
  }
}

test();
