import fs from 'fs';

const url = 'https://qmclfjialccotbjgoqja.supabase.co/rest/v1/';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk';

async function getSpec() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    const spec = await res.json();
    
    fs.writeFileSync('supabase_openapi.json', JSON.stringify(spec, null, 2));
    console.log('OpenAPI spec saved to supabase_openapi.json');

    // Print definitions for key tables
    const tables = ['locales', 'habitaciones', 'citas', 'horarios_empleados'];
    tables.forEach(t => {
      console.log(`\n=== Table: ${t} ===`);
      if (spec.definitions && spec.definitions[t]) {
        console.log('Properties:', Object.keys(spec.definitions[t].properties));
        console.log('Details:', spec.definitions[t].properties);
      } else {
        console.log('Not found in definitions');
      }
    });

  } catch (err) {
    console.error(err);
  }
}

getSpec();
