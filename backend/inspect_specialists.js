import { supabase } from './src/config/supabase.js';

async function run() {
  try {
    const { data: emps } = await supabase.from('empleados').select('*').limit(5);
    console.log("=== EMPLOYEES KEYS AND VALUES ===");
    emps.forEach(e => {
      console.log(e.nombres, e.apellido_paterno, Object.keys(e));
      console.log(e);
    });
  } catch (error) {
    console.error(error);
  }
}

run();
