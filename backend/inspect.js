import { supabase } from './src/config/supabase.js';

async function run() {
  try {
    const { data: servicios } = await supabase.from('servicios').select('*');
    const { data: areas } = await supabase.from('areas').select('*');

    const areaMap = new Map(areas.map(a => [a.id, a.nombre]));

    const mapped = servicios.map(s => ({
      id: s.id,
      nombre_servicio: s.nombre_servicio,
      area: areaMap.get(s.area_id),
      areas_ids: s.areas_ids ? s.areas_ids.map(id => areaMap.get(id)) : []
    }));

    console.log(JSON.stringify(mapped, null, 2));

  } catch (error) {
    console.error(error);
  }
}

run();
