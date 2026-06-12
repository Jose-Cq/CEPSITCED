import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmclfjialccotbjgoqja.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xmamlhbGNjb3RiamdvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTA3NTYsImV4cCI6MjA5Mjg4Njc1Nn0.m2ByvM4clnwMDPKYdxX4qaUG0fAhQI3ROXhzX3RxAGk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const candidates = {
  landing_configuracion: [
    'id', 'mision_subtitulo', 'mision_texto', 'vision_subtitulo', 'vision_texto', 
    'mostrar_nosotros', 'created_at', 'updated_at', 'activo', 'titulo', 'subtitulo'
  ],
  landing_personal: [
    'id', 'empleado_id', 'nro_cpsp', 'horario', 'modalidad', 'imagen_perfil_url', 
    'perfil_profesional', 'formacion_1', 'formacion_2', 'formacion_3', 'formacion_4', 
    'orden', 'activo', 'created_at', 'updated_at'
  ],
  landing_testimonios: [
    'id', 'nombre_ficticio', 'comentario', 'calificacion', 'orden', 'activo', 
    'created_at', 'updated_at'
  ],
  empleados: [
    'id', 'nombres', 'apellido_paterno', 'apellido_materno', 'rol_sistema', 
    'activo', 'created_at', 'updated_at', 'email', 'telefono'
  ],
  asignaciones_empleado: [
    'id', 'empleado_id', 'cargo_id', 'area_id', 'activo', 'created_at', 'updated_at'
  ],
  areas: [
    'id', 'nombre', 'descripcion', 'activo', 'created_at', 'updated_at'
  ],
  cargos: [
    'id', 'nombre', 'descripcion', 'activo', 'created_at', 'updated_at'
  ]
};

async function probe() {
  for (const [table, cols] of Object.entries(candidates)) {
    console.log(`\nProbing table: ${table}`);
    const existing = [];
    for (const col of cols) {
      const { error } = await supabase.from(table).select(col).limit(0);
      if (!error) {
        existing.push(col);
      } else if (error.message.includes('Could not find the column') || error.message.includes('column does not exist')) {
        // Column doesn't exist, ignore
      } else {
        console.log(`  Col ${col} error: ${error.message}`);
      }
    }
    console.log(`  Existing Columns:`, existing);
  }
}

probe();
