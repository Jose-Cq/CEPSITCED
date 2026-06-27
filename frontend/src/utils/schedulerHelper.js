export const BUFFER_MINUTOS = 30;

/**
 * Convierte un formato de hora 'HH:MM' a minutos transcurridos desde las 00:00.
 * @param {string} timeStr - Cadena de hora.
 * @returns {number} - Minutos transcurridos.
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
};

/**
 * Genera bloques de 30 minutos dentro del rango laboral de la jornada.
 * Valida que cada slot tenga suficiente espacio para completarse dentro de la jornada laboral.
 * @param {string} horaInicioShift - Hora de inicio de jornada.
 * @param {string} horaFinShift - Hora de fin de jornada.
 * @param {number} duracionServicioMinutos - Duración del servicio en minutos.
 * @returns {Array} - Arreglo de objetos con inicio y fin de cada slot.
 */
export const generarSlots30Min = (horaInicioShift, horaFinShift, duracionServicioMinutos) => {
  const formatMinutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const slots = [];
  const shiftStartMin = parseTimeToMinutes(horaInicioShift);
  const shiftEndMin = parseTimeToMinutes(horaFinShift);

  for (let min = shiftStartMin; min + duracionServicioMinutos <= shiftEndMin; min += 30) {
    slots.push({
      inicio: formatMinutesToTime(min),
      fin: formatMinutesToTime(min + duracionServicioMinutos)
    });
  }

  return slots;
};

/**
 * Filtra y obtiene los slots libres de 30 minutos considerando bloqueos y citas activas.
 * @param {Array} horarios - Bloques horarios del día.
 * @param {Array} citas - Citas agendadas para el día.
 * @param {number} duracionServicioMinutos - Duración del servicio.
 * @param {number} bufferMinutos - Minutos de colchón/buffer.
 * @returns {Array} - Slots libres mapeados.
 */
export const obtenerSlotsLibresDia = (horarios, citas, duracionServicioMinutos, bufferMinutos = BUFFER_MINUTOS) => {
  // 1. Obtener rangos laborales (disponible = true, tipo !== 'ausencia', tipo !== 'reprogramado_origen')
  const rangosLaborales = (horarios || []).filter(h =>
    h.disponible &&
    h.tipo !== 'ausencia' &&
    h.tipo !== 'reprogramado_origen'
  );

  // 2. Generar todos los slots posibles de 30 minutos a partir de los rangos laborales
  let todosLosSlots = [];
  rangosLaborales.forEach(r => {
    const slotsDeRango = generarSlots30Min(r.hora_inicio, r.hora_fin, duracionServicioMinutos);
    todosLosSlots = todosLosSlots.concat(slotsDeRango);
  });

  // Eliminar duplicados si los hubiera
  const slotsUnicos = [];
  const vistas = new Set();
  todosLosSlots.forEach(s => {
    const key = `${s.inicio}-${s.fin}`;
    if (!vistas.has(key)) {
      vistas.add(key);
      slotsUnicos.push(s);
    }
  });

  // 3. Obtener rangos de bloqueo (disponible = false, o tipo === 'ausencia' o tipo === 'reprogramado_origen')
  const rangosBloqueo = (horarios || []).filter(h =>
    !h.disponible ||
    h.tipo === 'ausencia' ||
    h.tipo === 'reprogramado_origen'
  );

  // 4. Obtener citas activas que bloquean (estado === Pendiente, Confirmada, Reprogramada, En consulta)
  const citasBloqueantes = (citas || []).filter(c => {
    const estado = (c.estado_cita || '').toLowerCase();
    return estado === 'pendiente' || estado === 'confirmada' || estado === 'reprogramada' || estado === 'en consulta';
  });

  // 5. Filtrar slots que se solapen con bloqueos o citas
  const slotsLibres = slotsUnicos.filter(slot => {
    const slotStart = parseTimeToMinutes(slot.inicio);
    const slotEnd = slotStart + duracionServicioMinutos;

    // Verificar si se solapa con algún rango de bloqueo
    const solapaConBloqueo = rangosBloqueo.some(b => {
      const bStart = parseTimeToMinutes(b.hora_inicio);
      const bEnd = parseTimeToMinutes(b.hora_fin);
      return slotStart < bEnd && slotEnd > bStart;
    });

    if (solapaConBloqueo) return false;

    // Verificar si se solapa con alguna cita activa
    const solapaConCita = citasBloqueantes.some(c => {
      const blockStart = parseTimeToMinutes(c.hora_inicio);
      const blockEnd = parseTimeToMinutes(c.hora_fin) + bufferMinutos;
      return slotStart < blockEnd && slotEnd > blockStart;
    });

    if (solapaConCita) return false;

    return true;
  });

  return slotsLibres.map(slot => ({
    id: `slot-${slot.inicio}-${slot.fin}`,
    inicio: slot.inicio,
    fin: slot.fin,
    hora_inicio: slot.inicio,
    hora_fin: slot.fin
  }));
};

/**
 * Filtra slots disponibles según la capacidad de consultorios del local.
 * Para modalidad Presencial, si el bloque horario ya tiene tantas citas activas
 * como consultorios tiene el local, ese slot se bloquea para toda la sede.
 * @param {Array} slots - Slots a filtrar
 * @param {Array} allCitasDelDia - Todas las citas activas del día (de la sede)
 * @param {Array} localRooms - Habitaciones/consultorios del local
 * @param {number} duracionServicioMinutos - Duración del servicio en minutos
 * @returns {Array} - Slots que aún tienen capacidad libre en el local
 */
export const filtrarSlotsPorCapacidadLocal = (slots, allCitasDelDia, localRooms, duracionServicioMinutos) => {
  if (!localRooms || localRooms.length === 0) return slots;
  const totalRooms = localRooms.length;

  const roomIds = new Set(localRooms.map(r => r.id));

  const citasConHabitacionEnLocal = (allCitasDelDia || []).filter(c =>
    c.habitacion_id && roomIds.has(c.habitacion_id)
  );

  return slots.filter(slot => {
    const slotStart = parseTimeToMinutes(slot.inicio);
    const slotEnd = slotStart + duracionServicioMinutos;

    const ocupadas = citasConHabitacionEnLocal.filter(c => {
      const cStart = parseTimeToMinutes(c.hora_inicio);
      const cEnd = parseTimeToMinutes(c.hora_fin);
      return slotStart < cEnd && slotEnd > cStart;
    }).length;

    return ocupadas < totalRooms;
  });
};
