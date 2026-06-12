// Using global fetch

const url = 'https://qmclfjialccotbjgoqja.supabase.co/rest/v1/';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk';

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
  'perfiles',
  'psicologo_servicio'
];

async function inspect() {
  for (const table of tables) {
    try {
      const res = await fetch(`${url}${table}?limit=1`, {
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'text/csv'
        }
      });
      if (res.ok) {
        const text = await res.text();
        const headers = text.split('\n')[0].trim();
        console.log(`Table: ${table} -> Columns: [${headers}]`);
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
