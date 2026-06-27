import { supabase } from './src/config/supabase.js';

async function run() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: schedules } = await supabase
      .from('horarios_empleados')
      .select('*')
      .gte('fecha', today);

    const schedsPerEmp = {};
    schedules.forEach(s => {
      if (!schedsPerEmp[s.empleado_id]) schedsPerEmp[s.empleado_id] = [];
      schedsPerEmp[s.empleado_id].push({
        fecha: s.fecha,
        disponible: s.disponible,
        modalidad: s.modalidad,
        local_id: s.local_id
      });
    });

    const { data: emps } = await supabase.from('empleados').select('*');
    const empMap = new Map(emps.map(e => [e.id, `${e.nombres} ${e.apellido_paterno || ''}`]));

    for (const empId in schedsPerEmp) {
      console.log(`\n=== Schedules for ${empMap.get(empId)} (${empId}) ===`);
      console.log(schedsPerEmp[empId]);
    }

  } catch (error) {
    console.error(error);
  }
}

run();
