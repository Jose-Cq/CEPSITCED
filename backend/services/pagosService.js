/**
 * Obtiene los métodos de pago de la clínica.
 * @returns {Promise<Array|null>}
 */
export const obtenerMetodosPagoClinica = async () => {
  try {
    const res = await fetch('/api/pagos/metodos');
    if (!res.ok) throw new Error('Error al obtener métodos de pago desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerMetodosPagoClinica:', err.message);
    return null;
  }
};
