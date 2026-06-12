import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log('Querying landing_persona...');
  const { data, error } = await supabase.from('landing_persona').select('*');
  if (error) {
    console.log('Error querying landing_persona:', error.message);
  } else {
    console.log('Success! landing_persona Count:', data.length);
    console.log('landing_persona Data:', data);
  }

  console.log('\nQuerying landing_personal...');
  const { data: data2, error: error2 } = await supabase.from('landing_personal').select('*');
  if (error2) {
    console.log('Error querying landing_personal:', error2.message);
  } else {
    console.log('Success! landing_personal Count:', data2.length);
    console.log('landing_personal Data:', data2);
  }
}

test();
