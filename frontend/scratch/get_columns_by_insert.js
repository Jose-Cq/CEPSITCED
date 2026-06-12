import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const tables = [
  'landing_configuracion',
  'landing_personal',
  'landing_testimonios',
  'empleados',
  'asignaciones_empleado',
  'areas',
  'cargos',
  'citas',
  'pacientes',
  'perfiles'
]

async function inspect() {
  for (const table of tables) {
    console.log(`\n--- Inspecting Table: ${table} ---`);
    try {
      // 1. Try to insert empty object
      const { data, error } = await supabase.from(table).insert([{}]).select();
      if (error) {
        console.log(`Insert failed: ${error.message}`);
        console.log(`Error Details:`, error);
      } else if (data && data.length > 0) {
        const row = data[0];
        const cols = Object.keys(row);
        console.log(`SUCCESS! Columns:`, cols);
        console.log(`Sample Row:`, row);
        
        // Cleanup
        // Try to delete the inserted row using primary key if possible, or any column
        const pkCol = cols.includes('id') ? 'id' : (cols.includes('id_paciente') ? 'id_paciente' : cols[0]);
        const pkVal = row[pkCol];
        const { error: delErr } = await supabase.from(table).delete().eq(pkCol, pkVal);
        if (delErr) {
          console.log(`Cleanup failed: ${delErr.message}`);
        } else {
          console.log(`Cleanup success.`);
        }
      } else {
        console.log(`Insert succeeded but returned no data.`);
      }
    } catch (err) {
      console.log(`Exception: ${err.message}`);
    }
  }
}

inspect();
