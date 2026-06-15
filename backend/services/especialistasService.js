/**
 * Obtiene los especialistas de la landing agregados dinámicamente.
 * @returns {Promise<Array>}
 */
export const obtenerEspecialistasLanding = async () => {
  try {
    const res = await fetch('/api/especialistas/landing');
    if (!res.ok) throw new Error('Error al obtener especialistas de la landing desde la API');
    const data = await res.json();
    return (data || []).map(item => ({
      id: item.id,
      nombreCompleto: item.nombreCompleto || item.nombre || 'Especialista',
      cargo: item.cargo || '',
      area: item.area || '',
      nroCpsp: item.nroCpsp || item.colegiatura || '',
      horario: item.horario || item.atencion || 'Horarios a consultar',
      modalidad: item.modalidad || 'Presencial y Virtual',
      imagenPerfilUrl: item.imagenPerfilUrl || item.foto || '',
      perfilProfesional: item.perfilProfesional || item.descripcion || 'Especialista en psicología con enfoque integral.',
      formaciones: Array.isArray(item.formaciones) ? item.formaciones : (item.estudios || []),
      activo: item.activo !== undefined ? item.activo : true
    }));
  } catch (err) {
    console.error('Error en obtenerEspecialistasLanding:', err.message);
    return [];
  }
};
