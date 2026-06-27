/**
 * Consulta y valida un cupón contra las reglas de negocio de manera desacoplada.
 * Lanza un error con un mensaje descriptivo si alguna regla de negocio falla.
 * 
 * @param {object} params - Parámetros de validación.
 * @param {string} params.codigo - Código del cupón.
 * @param {string|number} params.servicioId - ID del servicio seleccionado.
 * @param {string|number} params.paqueteId - ID del paquete seleccionado (si hay).
 * @param {string} params.pacienteId - ID del paciente para el límite de usos.
 * @param {object} params.supabase - Instancia del cliente de Supabase.
 * @returns {Promise<object>} - Datos del cupón si es válido.
 */
export const fetchAndValidateCoupon = async ({ codigo, servicioId, paqueteId, pacienteId, supabase }) => {
  if (!codigo || !codigo.trim()) {
    throw new Error('Por favor ingresa un código de cupón.');
  }

  const res = await fetch(`/api/servicios/cupon/${encodeURIComponent(codigo.trim())}`);
  const resData = await res.json();

  if (!res.ok || !resData.success || !resData.data) {
    throw new Error('Cupón inválido o inactivo.');
  }

  const coupon = resData.data;

  // 1. Validar fechas utilizando huso horario local (sv-SE retorna YYYY-MM-DD local)
  const todayStr = new Date().toLocaleDateString('sv-SE');
  if (coupon.fecha_inicio && todayStr < coupon.fecha_inicio) {
    throw new Error('El cupón aún no está vigente.');
  }
  if (coupon.fecha_fin && todayStr > coupon.fecha_fin) {
    throw new Error('El cupón ha caducado.');
  }

  // 2. Validar cantidad de usos
  if (coupon.cantidad_usos_maximo !== null && coupon.cantidad_usos_actual >= coupon.cantidad_usos_maximo) {
    throw new Error('El cupón ha alcanzado su límite de usos.');
  }

  // 3. Validar coincidencia de servicio o paquete
  if (coupon.servicio_id && coupon.servicio_id !== servicioId) {
    throw new Error('Este cupón no aplica para el servicio seleccionado.');
  }
  if (coupon.paquete_catalogo_id && coupon.paquete_catalogo_id !== paqueteId) {
    throw new Error('Este cupón no aplica para el paquete seleccionado.');
  }

  // 4. Validar tipo de cupón: Empresa / Convenio
  if (coupon.tipo_cupon === 'Empresa') {
    console.log(`INFO: Se aplicó el cupón corporativo de la empresa "${coupon.empresa_nombre}" sin validación del paciente por falta de relación en base de datos.`);
  }

  // 5. Validar un uso por paciente
  if (coupon.un_uso_por_paciente && pacienteId) {
    const { data: usage, error: usageErr } = await supabase
      .from('cupones_usos')
      .select('id')
      .eq('cupon_id', coupon.id)
      .eq('paciente_id', pacienteId)
      .limit(1);

    if (usageErr) {
      throw new Error('Error al verificar usos del cupón.');
    }

    if (usage && usage.length > 0) {
      throw new Error('Ya has utilizado este cupón anteriormente.');
    }
  }

  return coupon;
};
