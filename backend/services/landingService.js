/**
 * Obtiene los slides activos para el carrusel de la landing.
 * @returns {Promise<Array>}
 */
export const obtenerCarruselLanding = async () => {
  try {
    const res = await fetch('/api/landing/carousel');
    if (!res.ok) throw new Error('Error al obtener carrusel desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerCarruselLanding:', err.message);
    return [];
  }
};

/**
 * Obtiene la configuración de la landing.
 * @returns {Promise<Object|null>}
 */
export const obtenerConfiguracionLanding = async () => {
  try {
    const res = await fetch('/api/landing/configuracion');
    if (!res.ok) throw new Error('Error al obtener configuración desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerConfiguracionLanding:', err.message);
    return null;
  }
};

/**
 * Obtiene los testimonios activos para la landing.
 * @returns {Promise<Array>}
 */
export const obtenerTestimoniosLanding = async () => {
  try {
    const res = await fetch('/api/landing/testimonios');
    if (!res.ok) throw new Error('Error al obtener testimonios desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerTestimoniosLanding:', err.message);
    return [];
  }
};

/**
 * Obtiene las preguntas frecuentes (FAQs) activas para la landing.
 * @returns {Promise<Array>}
 */
export const obtenerFaqsLanding = async () => {
  try {
    const res = await fetch('/api/landing/faq');
    if (!res.ok) throw new Error('Error al obtener FAQs desde la API');
    return await res.json();
  } catch (err) {
    console.error('Error en obtenerFaqsLanding:', err.message);
    return [];
  }
};

