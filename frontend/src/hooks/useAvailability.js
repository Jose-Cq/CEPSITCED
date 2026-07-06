import { useState, useMemo } from 'react';
import {
  BUFFER_MINUTOS,
  obtenerSlotsLibresDia,
  filtrarSlotsPorCapacidadLocal
} from '../utils/schedulerHelper';

/**
 * Hook que encapsula toda la lógica de disponibilidad horaria:
 * - Verificación de disponibilidad por local, servicio, especialista y modalidad
 * - Cálculo de fechas habilitadas y slots del día
 * - Filtrado de especialistas y servicios según disponibilidad
 */
export const useAvailability = ({ dbData, servicioSeleccionado, modalidad, localSeleccionado }) => {
  const [fechasHabilitadas, setFechasHabilitadas] = useState(new Set());
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [slotsDisponibles, setSlotsDisponibles] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  const filtrarSlotsPorLocal = (slots, fecha, localRooms, duracion) => {
    if (!localRooms || localRooms.length === 0) return slots;
    const allCitasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha);
    return filtrarSlotsPorCapacidadLocal(slots, allCitasDelDia, localRooms, duracion);
  };

  const checkLocalAvailability = (localId, currentModalidad = 'Presencial') => {
    const services = (dbData.servicios || []).filter(s => 
      s && (s.local_id === localId || (Array.isArray(s.locales_ids) && s.locales_ids.includes(localId)))
    );
    if (services.length === 0) return false;

    const serviceIds = services.map(s => s?.id);
    const specialistIds = (dbData.psicologoServicio || [])
      .filter(ps => ps && serviceIds.includes(ps?.servicio_id))
      .map(ps => ps?.psicologo_id);
  
    const activeSpecialists = (dbData.employees || []).filter(e => e && e.activo && specialistIds.includes(e.id));
    if (activeSpecialists.length === 0) return false;

    const schedules = (dbData.horarios || []).filter(h => 
      h && h.modalidad === currentModalidad && 
      h.local_id === localId && 
      specialistIds.includes(h.empleado_id) &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );
    if (schedules.length === 0) return false;

    let localRooms = [];
    if (currentModalidad === 'Presencial') {
      localRooms = (dbData.rooms || []).filter(r => r && r.local_id === localId && r.activo);
      if (localRooms.length === 0) return false;
    }

    const groups = {};
    schedules.forEach(s => {
      const key = `${s.fecha}-${s.empleado_id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    for (const key in groups) {
      const [fecha, empleadoId] = key.split('-');
      const schedulesDelDia = groups[key];
      const citasDelDia = (dbData.citas || []).filter(c => c && c.fecha_cita === fecha && c.psicologo_id === empleadoId);
      
      const minDuration = Math.min(...services.map(s => s?.duracion_minutos || s?.duracion || 60));
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, minDuration, BUFFER_MINUTOS);
      if (currentModalidad === 'Presencial') {
        slots = filtrarSlotsPorLocal(slots, fecha, localRooms, minDuration);
      }

      if (slots.length > 0) return true;
    }

    return false;
  };

  const checkServiceAvailability = (service, currentModalidad, localId) => {
    if (!service || !currentModalidad) return false;
    
    if (!localId) return false;
    const isAssociated = service.local_id === localId || (Array.isArray(service.locales_ids) && service.locales_ids.includes(localId));
    if (!isAssociated) return false;

    const specialistIds = (dbData.psicologoServicio || [])
      .filter(ps => ps && ps.servicio_id === service.id)
      .map(ps => ps?.psicologo_id);
    
    const activeSpecialists = (dbData.employees || []).filter(e => e && e.activo && specialistIds.includes(e.id));
    if (activeSpecialists.length === 0) return false;

    const schedules = (dbData.horarios || []).filter(h => 
      h && h.modalidad === currentModalidad && 
      h.local_id === localId &&
      specialistIds.includes(h.empleado_id) &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );
    if (schedules.length === 0) return false;

    let localRooms = [];
    if (currentModalidad === 'Presencial') {
      localRooms = (dbData.rooms || []).filter(r => r && r.local_id === localId && r.activo);
      if (localRooms.length === 0) return false;
    }

    const duration = service.duracion_minutos || service.duracion || 60;
    
    const groups = {};
    schedules.forEach(s => {
      const key = `${s.fecha}-${s.empleado_id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    for (const key in groups) {
      const [fecha, empleadoId] = key.split('-');
      const schedulesDelDia = groups[key];
      const citasDelDia = (dbData.citas || []).filter(c => c && c.fecha_cita === fecha && c.psicologo_id === empleadoId);
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, duration, BUFFER_MINUTOS);
      
      if (currentModalidad === 'Presencial') {
        slots = filtrarSlotsPorLocal(slots, fecha, localRooms, duration);
      }

      if (slots.length > 0) return true;
    }

    return false;
  };

  const checkSpecialistAvailability = (specialist, service, currentModalidad, localId) => {
    if (!specialist || !service || !currentModalidad) return false;
    
    const isAssigned = (dbData.psicologoServicio || []).some(ps => ps && ps.psicologo_id === specialist.id && ps.servicio_id === service.id);
    if (!isAssigned) return false;

    const schedules = (dbData.horarios || []).filter(h => 
      h && h.empleado_id === specialist.id &&
      h.modalidad === currentModalidad && 
      h.local_id === localId &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );
    if (schedules.length === 0) return false;

    let localRooms = [];
    if (currentModalidad === 'Presencial') {
      localRooms = (dbData.rooms || []).filter(r => r && r.local_id === localId && r.activo);
      if (localRooms.length === 0) return false;
    }

    const duration = service.duracion_minutos || service.duracion || 60;
    
    const groups = {};
    schedules.forEach(s => {
      const key = s.fecha;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    for (const fecha in groups) {
      const schedulesDelDia = groups[fecha];
      const citasDelDia = (dbData.citas || []).filter(c => c && c.fecha_cita === fecha && c.psicologo_id === specialist.id);
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, duration, BUFFER_MINUTOS);
      
      if (currentModalidad === 'Presencial') {
        slots = filtrarSlotsPorLocal(slots, fecha, localRooms, duration);
      }

      if (slots.length > 0) return true;
    }

    return false;
  };

  const calcularFechaMasProxima = (psicologoId, currentModalidad, localId) => {
    if (!currentModalidad) return null;
    const duration = (servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 60);
    
    const schedules = (dbData.horarios || []).filter(h => 
      h && h.empleado_id === psicologoId &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro' &&
      h.modalidad === currentModalidad && 
      h.local_id === localId
    );
    if (schedules.length === 0) return null;

    let localRooms = [];
    if (currentModalidad === 'Presencial' && localId) {
      localRooms = (dbData.rooms || []).filter(r => r && r.local_id === localId && r.activo);
      if (localRooms.length === 0) return null;
    }

    const uniqueFechas = [...new Set(schedules.map(h => h.fecha))].sort();

    for (const fecha of uniqueFechas) {
      const schedulesDelDia = schedules.filter(h => h.fecha === fecha);
      const citasDelDia = (dbData.citas || []).filter(c => c && c.fecha_cita === fecha && c.psicologo_id === psicologoId);
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, duration, BUFFER_MINUTOS);
      
      if (currentModalidad === 'Presencial') {
        slots = filtrarSlotsPorLocal(slots, fecha, localRooms, duration);
      }

      if (slots.length > 0) return fecha;
    }

    return null;
  };

  const cargarFechasHabilitadas = (psicologoId, currentModalidad, localId) => {
    if (!servicioSeleccionado || !currentModalidad) return new Set();
    const duration = servicioSeleccionado.duracion_minutos || servicioSeleccionado.duracion || 60;
    
    const schedules = (dbData.horarios || []).filter(h => 
      h && h.empleado_id === psicologoId &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro' &&
      h.modalidad === currentModalidad && 
      h.local_id === localId
    );

    let localRooms = [];
    if (currentModalidad === 'Presencial' && localId) {
      localRooms = (dbData.rooms || []).filter(r => r && r.local_id === localId && r.activo);
    }

    const habilitadas = new Set();
    const uniqueFechas = [...new Set(schedules.map(h => h.fecha))];

    for (const fecha of uniqueFechas) {
      const schedulesDelDia = schedules.filter(h => h.fecha === fecha);
      const citasDelDia = (dbData.citas || []).filter(c => c && c.fecha_cita === fecha && c.psicologo_id === psicologoId);
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, duration, BUFFER_MINUTOS);
      
      if (currentModalidad === 'Presencial' && localRooms.length > 0) {
        slots = filtrarSlotsPorLocal(slots, fecha, localRooms, duration);
      }

      if (slots.length > 0) {
        habilitadas.add(fecha);
      }
    }
    return habilitadas;
  };

  const cargarSlotsDelDia = (psicologoId, fechaStr, currentModalidad, localId) => {
    if (!servicioSeleccionado || !currentModalidad) return [];
    const duration = servicioSeleccionado.duracion_minutos || servicioSeleccionado.duracion || 60;
    
    const schedules = (dbData.horarios || []).filter(h => 
      h && h.empleado_id === psicologoId &&
      h.fecha === fechaStr &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro' &&
      h.modalidad === currentModalidad && 
      h.local_id === localId
    );

    const citasDelDia = (dbData.citas || []).filter(c => 
      c && c.fecha_cita === fechaStr && 
      c.psicologo_id === psicologoId
    );

    let slots = obtenerSlotsLibresDia(schedules, citasDelDia, duration, BUFFER_MINUTOS);

    if (currentModalidad === 'Presencial' && localId) {
      const localRooms = (dbData.rooms || []).filter(r => r && r.local_id === localId && r.activo);
      if (localRooms.length > 0) {
        slots = filtrarSlotsPorLocal(slots, fechaStr, localRooms, duration);
      }
    }

    return slots;
  };

  const checkModalityAvailability = (mod) => {
    if (mod === 'Presencial') {
      return (dbData.locales || []).some(l => l && checkLocalAvailability(l.id));
    } else if (mod === 'Virtual') {
      return (dbData.locales || []).some(l => 
        l && (dbData.servicios || []).some(s => s && checkServiceAvailability(s, 'Virtual', l.id))
      );
    }
    return false;
  };

  const isPresencialAvailable = useMemo(() => checkModalityAvailability('Presencial'), [dbData]);
  const isVirtualAvailable = useMemo(() => checkModalityAvailability('Virtual'), [dbData]);

  const resetHorariosState = () => {
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
  };

  return {
    fechasHabilitadas, setFechasHabilitadas,
    fechaSeleccionada, setFechaSeleccionada,
    slotsDisponibles, setSlotsDisponibles,
    slotSeleccionado, setSlotSeleccionado,
    isPresencialAvailable,
    isVirtualAvailable,
    checkLocalAvailability,
    checkServiceAvailability,
    checkSpecialistAvailability,
    calcularFechaMasProxima,
    cargarFechasHabilitadas,
    cargarSlotsDelDia,
    checkModalityAvailability,
    resetHorariosState
  };
};
