import { supabase } from './src/config/supabase.js';
import { obtenerPrecioAplicable } from '../frontend/src/utils/pricingHelper.js';

async function run() {
  const serviceId = 'cb234e86-a416-4d80-aaf9-e20d338e2952'; // Consulta Psicológica
  const specialistId = '0f7d4b9e-b74f-4d66-a052-4773fbb8c6ca'; // Milagros Silvia Ordinola Villegas

  try {
    const { data: service } = await supabase.from('servicios').select('*').eq('id', serviceId).single();
    const { data: specialist } = await supabase.from('empleados').select('*').eq('id', specialistId).single();
    const { data: assignments } = await supabase.from('asignaciones_empleado').select('*').eq('empleado_id', specialistId);
    const { data: rules } = await supabase.from('reglas_precios').select('*').eq('servicio_id', serviceId);

    console.log("--- ORIGINAL BEHAVIOR (Virtual modality, localId = null) ---");
    const resOriginal = obtenerPrecioAplicable({
      servicio: service,
      especialista: specialist,
      reglasPrecios: rules,
      localId: null,
      modalidad: 'Virtual',
      asignaciones: assignments
    });
    console.log("Price resolved:", resOriginal.precioFinal, "matched rule:", resOriginal.tieneReglaPrecio);

    console.log("\n--- TEST: WITHOUT MODALIDAD RESTRICTION ON resolvedLocalId ---");
    // Simulate what happens if we change line 59 in pricingHelper.js to:
    // const resolvedLocalId = localId || specLocalId || servicio?.local_id || null;
    const testObtenerPrecioAplicable = ({
      servicio,
      paqueteCatalogo,
      especialista,
      reglasPrecios,
      localId,
      areaId,
      modalidad,
      asignaciones
    }) => {
      const precioBase = paqueteCatalogo 
        ? Number(paqueteCatalogo.precio_total || 0) 
        : (servicio ? Number(servicio.precio_sesion || 0) : 0);
    
      let cargo_id = especialista?.cargo_id || null;
      let area_id = especialista?.area_id || (servicio ? servicio.area_id : null);
      let specLocalId = null;
    
      if (especialista && asignaciones) {
        const empAsignaciones = asignaciones.filter(a => a.empleado_id === especialista.id);
        if (empAsignaciones.length > 0) {
          // Note: line 33 we can also keep or make it fall back
          const resolvedLocalId = localId || null;
          const serviceAreaId = areaId || servicio?.area_id;
    
          let asignacion = null;
          if (resolvedLocalId && serviceAreaId) {
            asignacion = empAsignaciones.find(a => a.local_id === resolvedLocalId && a.area_id === serviceAreaId);
          }
          if (!asignacion && resolvedLocalId) {
            asignacion = empAsignaciones.find(a => a.local_id === resolvedLocalId);
          }
          if (!asignacion && serviceAreaId) {
            asignacion = empAsignaciones.find(a => a.area_id === serviceAreaId);
          }
          if (!asignacion) {
            asignacion = empAsignaciones[0];
          }
    
          if (asignacion) {
            cargo_id = asignacion.cargo_id || cargo_id;
            area_id = asignacion.area_id || area_id;
            specLocalId = asignacion.local_id;
          }
        }
      }
    
      // Change line 59:
      const resolvedLocalId = localId || specLocalId || servicio?.local_id || null;
    
      const candidates = (reglasPrecios || []).filter(rule => {
        if (paqueteCatalogo) {
          if (rule.paquete_catalogo_id !== paqueteCatalogo.id) return false;
        } else {
          if (rule.servicio_id !== servicio?.id || rule.paquete_catalogo_id !== null) return false;
        }
    
        if (rule.local_id !== null && rule.local_id !== resolvedLocalId) return false;
        if (rule.area_id !== null && rule.area_id !== area_id) return false;
        if (rule.cargo_id !== null && rule.cargo_id !== cargo_id) return false;
        return true;
      });
    
      let bestRule = null;
      let maxScore = -1;
      candidates.forEach(rule => {
        let score = 0;
        if (rule.local_id !== null) score += 16;
        if (rule.cargo_id !== null) score += 8;
        if (rule.area_id !== null) score += 4;
        if (rule.paquete_catalogo_id !== null) score += 2;
    
        if (score > maxScore) {
          maxScore = score;
          bestRule = rule;
        }
      });
    
      const tieneReglaPrecio = Boolean(bestRule);
      const precioAntesPromocion = tieneReglaPrecio ? Number(bestRule.precio) : precioBase;
      return { precioFinal: precioAntesPromocion, tieneReglaPrecio };
    };

    const resTest = testObtenerPrecioAplicable({
      servicio: service,
      especialista: specialist,
      reglasPrecios: rules,
      localId: null,
      modalidad: 'Virtual',
      asignaciones: assignments
    });
    console.log("Price resolved (test):", resTest.precioFinal, "matched rule:", resTest.tieneReglaPrecio);

  } catch (error) {
    console.error(error);
  }
}

run();
