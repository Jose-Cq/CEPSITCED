const url = 'https://qmclfjialccotbjgoqja.supabase.co/rest/v1/';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk';

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
];

async function inspect() {
  for (const table of tables) {
    try {
      const res = await fetch(`${url}${table}`, {
        method: 'OPTIONS',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (res.ok) {
        const text = await res.text();
        console.log(`\n=== Table: ${table} ===`);
        console.log(`Status: ${res.status} ${res.statusText}`);
        console.log(`Headers:`, [...res.headers.entries()]);
        console.log(`Raw Response (first 500 chars):`, text.substring(0, 500));
      } else {
        const errText = await res.text();
        console.log(`Table: ${table} -> Error (${res.status}): ${errText}`);
      }
    } catch (err) {
      console.log(`Table: ${table} -> Exception: ${err.message}`);
    }
  }
}

inspect();
