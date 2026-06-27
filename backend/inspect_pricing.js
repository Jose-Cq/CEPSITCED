import { supabase } from './src/config/supabase.js';

async function run() {
  const serviceId = 'cb234e86-a416-4d80-aaf9-e20d338e2952'; // Consulta Psicológica
  const specialistId = '0f7d4b9e-b74f-4d66-a052-4773fbb8c6ca'; // Milagros Silvia Ordinola Villegas
  const localId = 'eac9a909-87ae-4b1a-bc2c-c9909590fcad'; // Sede Miraflores (assumed local matching assignments)
  const modality = 'Presencial'; // Check presencial matching local

  try {
    const { data: service } = await supabase.from('servicios').select('*').eq('id', serviceId).single();
    const { data: specialist } = await supabase.from('empleados').select('*').eq('id', specialistId).single();
    const { data: assignments } = await supabase.from('asignaciones_empleado').select('*').eq('empleado_id', specialistId);
    const { data: rules } = await supabase.from('reglas_precios').select('*').eq('servicio_id', serviceId);
    const { data: local } = await supabase.from('locales').select('*').eq('id', localId).single();

    console.log("=== STEP 1: RESOLVING SPECIALIST ASSIGNMENTS ===");
    console.log("Service id:", serviceId, "nombre:", service.nombre_servicio, "base price:", service.precio_sesion);
    console.log("Specialist name:", specialist.nombres, "id:", specialist.id);
    console.log("Assignments count:", assignments ? assignments.length : 0);
    console.log(JSON.stringify(assignments, null, 2));

    console.log("\n=== STEP 2: RUNNING obtenerAsignacionPsicologa LOGIC ===");
    const obtenerAsignacionPsicologaSim = (emp, s, loc) => {
      const empAsignaciones = assignments || [];
      const serviceAreaId = s?.area_id;
      const lId = loc?.id;

      console.log("  Matching parameters: local_id =", lId, ", area_id =", serviceAreaId);

      if (lId && serviceAreaId) {
        const match = empAsignaciones.find(a => a.local_id === lId && a.area_id === serviceAreaId);
        console.log("  Try match both local and area:", match ? "FOUND" : "NOT FOUND");
        if (match) return match;
      }
      if (lId) {
        const match = empAsignaciones.find(a => a.local_id === lId);
        console.log("  Try match local:", match ? "FOUND" : "NOT FOUND");
        if (match) return match;
      }
      if (serviceAreaId) {
        const match = empAsignaciones.find(a => a.area_id === serviceAreaId);
        console.log("  Try match area:", match ? "FOUND" : "NOT FOUND");
        if (match) return match;
      }
      console.log("  Fallback to first assignment:", empAsignaciones[0] ? "FOUND" : "NOT FOUND");
      return empAsignaciones[0];
    };

    const activeAsignacion = obtenerAsignacionPsicologaSim(specialist, service, local);
    console.log("Resolved Assignment:", JSON.stringify(activeAsignacion, null, 2));

    const cargo_id = activeAsignacion?.cargo_id || null;
    const area_id = activeAsignacion?.area_id || null;
    console.log("Resolved cargo_id:", cargo_id);
    console.log("Resolved area_id:", area_id);

    console.log("\n=== STEP 3: PRICE RULES FOR THIS SERVICE ===");
    console.log(JSON.stringify(rules, null, 2));

    console.log("\n=== STEP 4: FILTERING COMPATIBLE CANDIDATES ===");
    const localIdToCheck = (modality === 'Presencial' && local) ? local.id : null;
    console.log("localIdToCheck:", localIdToCheck);

    const candidates = rules.filter(rule => {
      console.log(`Checking rule ID: ${rule.id}`);
      // 1. Service / Package match
      if (rule.servicio_id !== serviceId || rule.paquete_catalogo_id !== null) {
        console.log(`  -> Discarded: service_id or package mismatch`);
        return false;
      }

      // 2. Local match
      if (rule.local_id !== null && rule.local_id !== localIdToCheck) {
        console.log(`  -> Discarded: rule.local_id ${rule.local_id} !== ${localIdToCheck}`);
        return false;
      }

      // 3. Area match
      if (rule.area_id !== null && rule.area_id !== area_id) {
        console.log(`  -> Discarded: rule.area_id ${rule.area_id} !== ${area_id}`);
        return false;
      }

      // 4. Cargo match
      if (rule.cargo_id !== null && rule.cargo_id !== cargo_id) {
        console.log(`  -> Discarded: rule.cargo_id ${rule.cargo_id} !== ${cargo_id}`);
        return false;
      }

      console.log(`  -> MATCHED!`);
      return true;
    });

    console.log("\nCandidates found:", candidates.length);
    console.log(JSON.stringify(candidates, null, 2));

  } catch (error) {
    console.error(error);
  }
}

run();
