/**
 * Arquitectura directa de precios y promociones:
 *
 * - Sesión Individual  → consulta columnas de promoción en `public.servicios`
 * - Paquete            → consulta columnas de promoción en `public.paquetes_catalogo`
 * - Especialista       → `public.reglas_precios` solo para precio neto por cargo/sede
 *                        (totalmente desvinculada de promociones generales)
 *
 * Flujo en cascada:
 * 1. Precio base: servicio (precio_sesion) o paquete (precio_total).
 * 2. Resuelve cargo/área del especialista desde asignaciones.
 * 3. Busca regla en reglas_precios que coincida por servicio_id + local + cargo.
 *    - SI HAY REGLA (Camino A): usa su precio. El descuento_porcentaje de la regla
 *      se valida solo con sus propias fechas, ignorando promociones del padre.
 *    - SI NO HAY REGLA (Camino B - Fallback): usa precio base y aplica promoción
 *      general del servicio/paquete si promocion_activa = true y fechas vigentes.
 *
 * REGLA DE FECHAS ABIERTAS: si promo_fecha_fin es NULL, la promoción es permanente.
 * Nunca retorna precio 0 a menos que el origen tenga 0 en BD.
 */
export const obtenerPrecioAplicable = ({
  servicio,
  paqueteCatalogo,
  especialista,
  reglasPrecios,
  localId,
  areaId,
  modalidad,
  asignaciones,
  cargos
}) => {
  const roundToTwo = (num) => parseFloat(Number(num).toFixed(2));
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Precio base
  const precioBase = paqueteCatalogo
    ? Number(paqueteCatalogo.precio_total || 0)
    : (servicio ? Number(servicio.precio_sesion || 0) : 0);

  // 2. Resolver cargo/área/local del especialista desde asignaciones
  let cargo_id = especialista?.cargo_id || null;
  let area_id = areaId || especialista?.area_id || servicio?.area_id || null;
  let specLocalId = null;

  if (especialista && asignaciones && asignaciones.length > 0) {
    const empAsignaciones = asignaciones.filter(a => a.empleado_id === especialista.id);
    if (empAsignaciones.length > 0) {
      const presencialLocal = (modalidad === 'Presencial' && localId) ? localId : null;
      const svcAreaId = areaId || servicio?.area_id;

      let asignacion = null;
      if (presencialLocal && svcAreaId)
        asignacion = empAsignaciones.find(a => a.local_id === presencialLocal && a.area_id === svcAreaId);
      if (!asignacion && presencialLocal)
        asignacion = empAsignaciones.find(a => a.local_id === presencialLocal);
      if (!asignacion && svcAreaId)
        asignacion = empAsignaciones.find(a => a.area_id === svcAreaId);
      if (!asignacion)
        asignacion = empAsignaciones[0];

      if (asignacion) {
        cargo_id = asignacion.cargo_id || cargo_id;
        area_id = asignacion.area_id || area_id;
        specLocalId = asignacion.local_id;
      }
    }
  }

  const resolvedLocalId = (modalidad === 'Presencial' ? localId : null) || specLocalId || servicio?.local_id || null;

  // 3. Buscar regla en reglas_precios
  const specialistCargoId = especialista?.cargo_id
    || especialista?.asignaciones_empleado?.cargo_id
    || (Array.isArray(especialista?.asignaciones_empleado) ? especialista.asignaciones_empleado[0]?.cargo_id : null)
    || especialista?.cargo?.id;

  const specialistCargoNombre = (especialista?.cargo?.nombre || especialista?.cargo_nombre || '').toLowerCase();

  const matchingRule = (reglasPrecios || []).find(r => {
    const matchServicio = r.servicio_id === servicio?.id;
    const matchLocal = !r.local_id || modalidad === 'Virtual' || r.local_id === resolvedLocalId;
    const matchCargo = !r.cargo_id || r.cargo_id === specialistCargoId || specialistCargoNombre.includes('doctor');
    return matchServicio && matchLocal && matchCargo;
  });

  // 4. CASCADA DE PRECIOS
  let precioAntesPromocion;
  let promocionActiva = false;
  let descuentoPorcentaje = null;
  let precioPromocional = null;

  if (matchingRule) {
    // --- PASO A: TIENE REGLA ---
    // Usa el precio de la regla. Si la regla no tiene precio propio, cae al base.
    precioAntesPromocion = matchingRule.precio ? Number(matchingRule.precio) : precioBase;

    // Independiente del servicio padre: aplica si la propia regla tiene descuento vigente
    const rulePromoInicio = matchingRule.promo_fecha_inicio;
    const rulePromoFin = matchingRule.promo_fecha_fin;
    const ruleDatesOk = (!rulePromoInicio || todayStr >= rulePromoInicio) && (!rulePromoFin || todayStr <= rulePromoFin);
    const ruleDiscount = matchingRule.descuento_porcentaje ? Number(matchingRule.descuento_porcentaje) : 0;

    if (ruleDiscount > 0 && ruleDatesOk) {
      promocionActiva = true;
      descuentoPorcentaje = ruleDiscount;
    }
  } else {
    // --- NO TIENE REGLA: fallback al precio base ---
    precioAntesPromocion = precioBase;

    // Verificar promoción general del servicio/paquete
    const itemConPromo = paqueteCatalogo || servicio;
    if (itemConPromo) {
      const promoInicio = itemConPromo.promo_fecha_inicio;
      const promoFin = itemConPromo.promo_fecha_fin;
      const datesOk = (!promoInicio || todayStr >= promoInicio) && (!promoFin || todayStr <= promoFin);

      promocionActiva = Boolean(itemConPromo.promocion_activa && datesOk);

      if (promocionActiva) {
        descuentoPorcentaje = itemConPromo.promo_descuento_porcentaje ? Number(itemConPromo.promo_descuento_porcentaje) : null;
        precioPromocional = itemConPromo.precio_promocional ? Number(itemConPromo.precio_promocional) : null;
      }
    }
  }

  // 5. Precio final
  let precioFinal = precioAntesPromocion;

  if (promocionActiva) {
    if (descuentoPorcentaje !== null && descuentoPorcentaje > 0) {
      precioFinal = precioAntesPromocion * (1 - descuentoPorcentaje / 100);
    } else if (precioPromocional !== null && precioPromocional > 0 && !matchingRule) {
      precioFinal = precioPromocional;
    }
  }

  const result = {
    precioBase: roundToTwo(precioBase),
    precioAntesPromocion: roundToTwo(precioAntesPromocion),
    precioFinal: Math.max(0, roundToTwo(precioFinal)),
    tieneReglaPrecio: Boolean(matchingRule),
    tienePromocion: promocionActiva,
    descuentoPorcentaje,
    precioPromocional,
    reglaAplicada: matchingRule ?? null
  };

  return result;
};
