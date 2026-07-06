import { useState, useEffect } from 'react';
import { obtenerMetodosPagoClinica } from '../utils/supabaseHelpers';

/**
 * Hook que carga y gestiona los métodos de pago de la clínica.
 */
export const usePaymentMethods = () => {
  const [metodosPagoClinica, setMetodosPagoClinica] = useState([]);
  const [loadingMetodosPago, setLoadingMetodosPago] = useState(false);
  const [metodoPagoOnlineDetalle, setMetodoPagoOnlineDetalle] = useState('TRANSFERENCIA');

  useEffect(() => {
    const cargarMetodosPago = async () => {
      setLoadingMetodosPago(true);
      try {
        const res = await obtenerMetodosPagoClinica();
        if (res) setMetodosPagoClinica(res);
      } catch (err) {
        console.error('Error al cargar métodos de pago de clínica:', err);
      } finally {
        setLoadingMetodosPago(false);
      }
    };
    cargarMetodosPago();
  }, []);

  useEffect(() => {
    if (metodosPagoClinica && metodosPagoClinica.length > 0) {
      const activeTypes = [...new Set(metodosPagoClinica.map(m => m.tipo))];
      if (activeTypes.length > 0 && !activeTypes.includes(metodoPagoOnlineDetalle)) {
        setMetodoPagoOnlineDetalle(activeTypes[0]);
      }
    }
  }, [metodosPagoClinica, metodoPagoOnlineDetalle]);

  return {
    metodosPagoClinica,
    loadingMetodosPago,
    metodoPagoOnlineDetalle,
    setMetodoPagoOnlineDetalle
  };
};
