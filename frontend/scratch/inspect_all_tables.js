import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const tables = [
  'landing_carousel',
  'landing_configuracion',
  'landing_personal',
  'landing_testimonios',
  'empleados',
  'asignaciones_empleado',
  'areas',
  'cargos',
  'horarios_empleados',
  'servicios',
  'locales',
  'citas',
  'pacientes',
  'pagos',
  'perfiles',
  'landing_proposito',
  'landing_proposito_items'
]

async function inspect() {
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table: ${table} - Error: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`Table: ${table} - Columns:`, Object.keys(data[0]));
        console.log(`Table: ${table} - Sample Row:`, JSON.stringify(data[0], null, 2));
      } else {
        // Let's try to get schema columns by selecting with a dummy filter or select('*') to see if table is empty
        console.log(`Table: ${table} - Empty (Exists but no rows)`);
      }
    } catch (err) {
      console.log(`Table: ${table} - Exception:`, err.message);
    }
  }
}

inspect();
