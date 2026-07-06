import { useState, useMemo } from 'react';
import { obtenerPrecioAplicable } from '../utils/pricingHelper';

/**
 * Hook que centraliza el cálculo de precios del agendamiento:
 * - Precio base + reglas por cargo/sede
 * - Promociones activas
 * - Descuentos por cupón
 */
export const useAppointmentPricing = ({
  servicioSeleccionado,
  paqueteSeleccionado,
  psicologaSeleccionada,
  localSeleccionado,
  modalidad,
  dbData
}) => {
  const [couponData, setCouponData] = useState(null);

  const precioFinalCalculado = useMemo(() => {
    if (!servicioSeleccionado) return 0;
    
    if (paqueteSeleccionado?.type === 'adquirido') {
      return 0;
    }
    
    const res = obtenerPrecioAplicable({
      servicio: servicioSeleccionado,
      paqueteCatalogo: paqueteSeleccionado?.type === 'catalogo' ? paqueteSeleccionado : null,
      especialista: psicologaSeleccionada,
      reglasPrecios: dbData.reglasPrecios,
      localId: localSeleccionado?.id || null,
      modalidad: modalidad,
      asignaciones: dbData.asignaciones,
      cargos: dbData.cargos
    });
    
    return res.precioFinal;
  }, [
    servicioSeleccionado,
    paqueteSeleccionado,
    psicologaSeleccionada,
    localSeleccionado,
    modalidad,
    dbData.reglasPrecios,
    dbData.asignaciones,
    dbData.cargos
  ]);

  const precioConDescuento = useMemo(() => {
    if (!couponData) return precioFinalCalculado;
    if (couponData.tipo_descuento === 'Porcentaje') {
      return Math.round(precioFinalCalculado * (1 - couponData.valor_descuento / 100));
    }
    if (couponData.tipo_descuento === 'Monto') {
      return Math.max(0, precioFinalCalculado - couponData.valor_descuento);
    }
    return precioFinalCalculado;
  }, [precioFinalCalculado, couponData]);

  const displayMontoEstimado = useMemo(() => {
    if (!servicioSeleccionado) return '-';
    if (paqueteSeleccionado?.type === 'adquirido') {
      return 'S/ 0 (Prepago)';
    }
    return `S/ ${precioFinalCalculado}`;
  }, [servicioSeleccionado, paqueteSeleccionado, precioFinalCalculado]);

  const precioMostrar = couponData ? precioConDescuento : precioFinalCalculado;

  return {
    couponData, setCouponData,
    precioFinalCalculado,
    precioConDescuento,
    displayMontoEstimado,
    precioMostrar
  };
};
