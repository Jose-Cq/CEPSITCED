import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
  console.log("Running query test...");
  try {
    // Let's get one patient from patients table
    const { data: patients } = await supabase
      .from('pacientes')
      .select('id_paciente, nombres, apellido_paterno')
      .limit(5);

    console.log("Sample patients:", patients);

    // Let's select from cita_pacientes_adicionales
    const { data: adicionales } = await supabase
      .from('cita_pacientes_adicionales')
      .select('*')
      .limit(5);

    console.log("Sample adicionales:", adicionales);

    if (adicionales && adicionales.length > 0) {
      const pid = adicionales[0].paciente_id;
      const { data: matches } = await supabase
        .from('cita_pacientes_adicionales')
        .select('cita_id')
        .eq('paciente_id', pid);

      const ids = (matches || []).map(m => m.cita_id).filter(Boolean);
      console.log(`Found cita_ids for patient ${pid}:`, ids);

      let query = supabase
        .from('citas')
        .select('id, paciente_id, servicio, fecha_cita');

      if (ids.length > 0) {
        query = query.or(`paciente_id.eq.${pid},id.in.(${ids.join(',')})`);
      } else {
        query = query.eq('paciente_id', pid);
      }

      const { data: citas, error } = await query;
      if (error) {
        console.error("Query Error:", error);
      } else {
        console.log("Matches found:", citas);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
