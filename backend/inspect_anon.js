import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const tables = [
      'locales',
      'servicios',
      'habitaciones',
      'empleados',
      'psicologo_servicio',
      'horarios_empleados',
      'citas',
      'cargos',
      'areas',
      'asignaciones_empleado',
      'reglas_precios',
      'paquetes_catalogo'
    ];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(5);
      if (error) {
        console.log(`Table ${table}: ERROR:`, error.message);
      } else {
        console.log(`Table ${table}: SUCCESS - Row count:`, data ? data.length : 0);
      }
    }

  } catch (error) {
    console.error(error);
  }
}

run();
