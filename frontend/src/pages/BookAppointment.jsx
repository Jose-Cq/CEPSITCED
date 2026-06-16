import { useState, useEffect, Fragment, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import {
  obtenerPaquetes,
  crearCita,
  obtenerMetodosPagoClinica
} from '../utils/supabaseHelpers';
import { supabase } from '../supabaseClient';

const BUFFER_MINUTOS = 30;

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
};

/**
 * Genera bloques de 30 minutos dentro del rango laboral de la jornada.
 * Valida que cada slot tenga suficiente espacio para completarse dentro de la jornada laboral.
 */
const generarSlots30Min = (horaInicioShift, horaFinShift, duracionServicioMinutos) => {
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
 */
const obtenerSlotsLibresDia = (horarios, citas, duracionServicioMinutos, bufferMinutos = BUFFER_MINUTOS) => {
  // 1. Obtener rangos laborales (disponible = true, tipo !== 'salida', tipo !== 'otro')
  const rangosLaborales = (horarios || []).filter(h =>
    h.disponible &&
    h.tipo !== 'salida' &&
    h.tipo !== 'otro'
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

  // 3. Obtener rangos de bloqueo (disponible = false, o tipo === 'salida' o tipo === 'otro')
  const rangosBloqueo = (horarios || []).filter(h =>
    !h.disponible ||
    h.tipo === 'salida' ||
    h.tipo === 'otro'
  );

  // 4. Obtener citas activas que bloquean (estado === Pendiente, Confirmada, Reprogramada)
  const citasBloqueantes = (citas || []).filter(c => {
    const estado = (c.estado_cita || '').toLowerCase();
    return estado === 'pendiente' || estado === 'confirmada' || estado === 'reprogramada';
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

const formatPhoneNumber = (val) => {
  if (!val) return '';
  const clean = String(val).replace(/\s+/g, '');
  if (clean.length === 9) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return val;
};

const BookAppointment = () => {
  const navigate = useNavigate();
  const { loading: loadingProfile, perfilUsuario, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();

  // Unified preloaded database data state
  const [dbData, setDbData] = useState({
    locales: [],
    servicios: [],
    rooms: [],
    employees: [],
    psicologoServicio: [],
    horarios: [],
    citas: [],
    loading: true,
    error: null
  });

  // Load all required data on component mount
  useEffect(() => {
    const loadAllDbData = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];

        const [
          { data: localesData, error: errLocales },
          { data: serviciosData, error: errServicios },
          { data: roomsData, error: errRooms },
          { data: employeesData, error: errEmployees },
          { data: psServData, error: errPsServ },
          { data: horariosData, error: errHorarios },
          { data: citasData, error: errCitas }
        ] = await Promise.all([
          supabase.from('locales').select('*').eq('activo', true),
          supabase.from('servicios').select('*').eq('activo', true),
          supabase.from('habitaciones').select('*').eq('activo', true),
          supabase.from('empleados').select('*').eq('activo', true),
          supabase.from('psicologo_servicio').select('*'),
          supabase.from('horarios_empleados').select('*').gte('fecha', todayStr),
          supabase.from('citas').select('id, fecha_cita, hora_inicio, hora_fin, estado_cita, psicologo_id, habitacion_id, modalidad').gte('fecha_cita', todayStr).in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada'])
        ]);

        if (errLocales) throw errLocales;
        if (errServicios) throw errServicios;
        if (errRooms) throw errRooms;
        if (errEmployees) throw errEmployees;
        if (errPsServ) throw errPsServ;
        if (errHorarios) throw errHorarios;
        if (errCitas) throw errCitas;

        const mappedEmployees = (employeesData || []).map(emp => ({
          ...emp,
          nombres_apellidos: `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
        }));

        setDbData({
          locales: localesData || [],
          servicios: serviciosData || [],
          rooms: roomsData || [],
          employees: mappedEmployees,
          psicologoServicio: psServData || [],
          horarios: horariosData || [],
          citas: citasData || [],
          loading: false,
          error: null
        });
      } catch (err) {
        console.error('Error preloading data:', err);
        setDbData(prev => ({ ...prev, loading: false, error: err.message }));
      }
    };

    loadAllDbData();
  }, []);

  // Wizard state (indexed steps)
  const [stepIndex, setStepIndex] = useState(0);
  const [paraQuien, setParaQuien] = useState('yo'); // 'yo' o 'familiar'
  const [familiarId, setFamiliarId] = useState('');
  const [modalidad, setModalidad] = useState(''); // Starts empty
  const [localSeleccionado, setLocalSeleccionado] = useState(null);
  
  // Search query for services
  const [buscarServicio, setBuscarServicio] = useState('');
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  
  const [tipoSesion, setTipoSesion] = useState('normal'); // 'normal' o 'paquete'
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState(null);
  const [paquetes, setPaquetes] = useState([]);
  const [paquetesAdquiridos, setPaquetesAdquiridos] = useState([]);

  const [psicologaSeleccionada, setPsicologaSeleccionada] = useState(null);
  
  const [fechasHabilitadas, setFechasHabilitadas] = useState(new Set());
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [slotsDisponibles, setSlotsDisponibles] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [comentario, setComentario] = useState('');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [tempComentario, setTempComentario] = useState('');
  const [metodoPago, setMetodoPago] = useState('clinica'); // 'clinica' o 'tarjeta'
  const [metodosPagoClinica, setMetodosPagoClinica] = useState([]);
  const [loadingMetodosPago, setLoadingMetodosPago] = useState(false);
  const [metodoPagoOnlineDetalle, setMetodoPagoOnlineDetalle] = useState('TRANSFERENCIA');
  const [showCulqiModal, setShowCulqiModal] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalRedirectOnClose, setPaymentModalRedirectOnClose] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Dynamic steps declaration based on modality
  const steps = useMemo(() => {
    const list = [
      { id: 'paciente', label: 'Paciente' },
      { id: 'modalidad', label: 'Modalidad' }
    ];
    if (modalidad !== 'Virtual') {
      list.push({ id: 'local', label: 'Local' });
    }
    list.push(
      { id: 'servicio_tipo', label: 'Servicio y Tipo' },
      { id: 'especialista', label: 'Especialista' },
      { id: 'horario', label: 'Fecha y Horario' },
      { id: 'pago', label: 'Pago' }
    );
    return list;
  }, [modalidad]);

  // Load payment methods on mount
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

  // Fetch catalog packages when service changes
  useEffect(() => {
    if (servicioSeleccionado) {
      obtenerPaquetes(servicioSeleccionado.id).then(res => {
        if (res.success) setPaquetes(res.data || []);
        else setPaquetes([]);
      });
    } else {
      setPaquetes([]);
    }
  }, [servicioSeleccionado]);

  // Fetch prepaid acquired packages
  useEffect(() => {
    const cargarPaquetesAdquiridos = async () => {
      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : familiarId;
      if (!pacienteId || !servicioSeleccionado) {
        setPaquetesAdquiridos([]);
        return;
      }
      try {
        const { data: packs, error: packsErr } = await supabase
          .from('paquetes_adquiridos')
          .select('*')
          .eq('paciente_id', pacienteId)
          .eq('servicio_id', servicioSeleccionado.id)
          .gt('sesiones_disponibles', 0);

        if (packsErr) throw packsErr;

        if (!packs || packs.length === 0) {
          setPaquetesAdquiridos([]);
          return;
        }

        const packsWithNet = await Promise.all(packs.map(async (p) => {
          const { count, error: countErr } = await supabase
            .from('citas')
            .select('*', { count: 'exact', head: true })
            .eq('paquete_id', p.id)
            .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

          if (countErr) throw countErr;

          const netas = p.sesiones_disponibles - (count || 0);
          return {
            ...p,
            citas_pendientes: count || 0,
            sesiones_netas: netas
          };
        }));

        setPaquetesAdquiridos(packsWithNet.filter(p => p.sesiones_netas > 0));
      } catch (err) {
        console.error('Error al cargar paquetes adquiridos:', err);
        setPaquetesAdquiridos([]);
      }
    };

    cargarPaquetesAdquiridos();
  }, [servicioSeleccionado, paraQuien, familiarId, perfilClinicoPropio]);

  // Helper date format
  const formatDateStr = (year, month, day) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Profile incomplete validations
  const isProfileIncomplete = (profile) => {
    if (!profile) return true;
    if (!profile.genero || !profile.direccion || !profile.pais) return true;
    if (profile.pais === 'Perú') {
      if (!profile.departamento || !profile.provincia || !profile.distrito) return true;
    }
    return false;
  };

  const esClinicoIncompletoYo = isProfileIncomplete(perfilClinicoPropio);
  const selectedDependent = perfilesDependientes?.find(d => d.id_paciente === familiarId);
  const esClinicoIncompletoFamiliar = familiarId ? isProfileIncomplete(selectedDependent) : false;

  // Active local selection memo
  const activeLocal = useMemo(() => {
    return localSeleccionado;
  }, [localSeleccionado]);

  // ----------------------------------------------------
  // AVAILABILITY SOLVERS (COMPLETELY LOCAL/SYNCHRONOUS)
  // ----------------------------------------------------

  // 1. Check if a local has real availability for presencial modality
  const checkLocalAvailability = (localId) => {
    const services = dbData.servicios.filter(s => 
      s.local_id === localId || (Array.isArray(s.locales_ids) && s.locales_ids.includes(localId))
    );
    if (services.length === 0) return false;

    const serviceIds = services.map(s => s.id);
    const specialistIds = dbData.psicologoServicio
      .filter(ps => serviceIds.includes(ps.servicio_id))
      .map(ps => ps.psicologo_id);
    
    const activeSpecialists = dbData.employees.filter(e => e.activo && specialistIds.includes(e.id));
    if (activeSpecialists.length === 0) return false;

    const schedules = dbData.horarios.filter(h => 
      h.modalidad === 'Presencial' && 
      h.local_id === localId && 
      specialistIds.includes(h.empleado_id) &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );
    if (schedules.length === 0) return false;

    const localRooms = dbData.rooms.filter(r => r.local_id === localId && r.activo);
    if (localRooms.length === 0) return false;

    const groups = {};
    schedules.forEach(s => {
      const key = `${s.fecha}-${s.empleado_id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    for (const key in groups) {
      const [fecha, empleadoId] = key.split('-');
      const schedulesDelDia = groups[key];
      const citasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha && c.psicologo_id === empleadoId);
      
      const minDuration = Math.min(...services.map(s => s.duracion_minutos || s.duracion || 60));
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, minDuration, BUFFER_MINUTOS);
      
      const allCitasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha);
      slots = slots.filter(slot => {
        const slotStart = parseTimeToMinutes(slot.inicio);
        const slotEnd = slotStart + minDuration;

        return localRooms.some(room => {
          const isOccupied = allCitasDelDia.some(c => {
            if (c.habitacion_id !== room.id) return false;
            const cStart = parseTimeToMinutes(c.hora_inicio);
            const cEnd = parseTimeToMinutes(c.hora_fin);
            return slotStart < cEnd && slotEnd > cStart;
          });
          return !isOccupied;
        });
      });

      if (slots.length > 0) return true;
    }

    return false;
  };

  // 2. Check if a service has real availability
  const checkServiceAvailability = (service, currentModalidad, localId) => {
    if (!currentModalidad) return false;
    
    if (currentModalidad === 'Presencial') {
      if (!localId) return false;
      const isAssociated = service.local_id === localId || (Array.isArray(service.locales_ids) && service.locales_ids.includes(localId));
      if (!isAssociated) return false;
    }

    const specialistIds = dbData.psicologoServicio
      .filter(ps => ps.servicio_id === service.id)
      .map(ps => ps.psicologo_id);
    
    const activeSpecialists = dbData.employees.filter(e => e.activo && specialistIds.includes(e.id));
    if (activeSpecialists.length === 0) return false;

    const schedules = dbData.horarios.filter(h => 
      h.modalidad === currentModalidad && 
      (currentModalidad === 'Virtual' || h.local_id === localId) &&
      specialistIds.includes(h.empleado_id) &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );
    if (schedules.length === 0) return false;

    let localRooms = [];
    if (currentModalidad === 'Presencial') {
      localRooms = dbData.rooms.filter(r => r.local_id === localId && r.activo);
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
      const citasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha && c.psicologo_id === empleadoId);
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, duration, BUFFER_MINUTOS);
      
      if (currentModalidad === 'Presencial') {
        const allCitasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha);
        slots = slots.filter(slot => {
          const slotStart = parseTimeToMinutes(slot.inicio);
          const slotEnd = slotStart + duration;

          return localRooms.some(room => {
            const isOccupied = allCitasDelDia.some(c => {
              if (c.habitacion_id !== room.id) return false;
              const cStart = parseTimeToMinutes(c.hora_inicio);
              const cEnd = parseTimeToMinutes(c.hora_fin);
              return slotStart < cEnd && slotEnd > cStart;
            });
            return !isOccupied;
          });
        });
      }

      if (slots.length > 0) return true;
    }

    return false;
  };

  // 3. Check if a specialist has real availability
  const checkSpecialistAvailability = (specialist, service, currentModalidad, localId) => {
    if (!service || !currentModalidad) return false;
    
    const isAssigned = dbData.psicologoServicio.some(ps => ps.psicologo_id === specialist.id && ps.servicio_id === service.id);
    if (!isAssigned) return false;

    const schedules = dbData.horarios.filter(h => 
      h.empleado_id === specialist.id &&
      h.modalidad === currentModalidad && 
      (currentModalidad === 'Virtual' || h.local_id === localId) &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );
    if (schedules.length === 0) return false;

    let localRooms = [];
    if (currentModalidad === 'Presencial') {
      localRooms = dbData.rooms.filter(r => r.local_id === localId && r.activo);
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
      const citasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha && c.psicologo_id === specialist.id);
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, duration, BUFFER_MINUTOS);
      
      if (currentModalidad === 'Presencial') {
        const allCitasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha);
        slots = slots.filter(slot => {
          const slotStart = parseTimeToMinutes(slot.inicio);
          const slotEnd = slotStart + duration;

          return localRooms.some(room => {
            const isOccupied = allCitasDelDia.some(c => {
              if (c.habitacion_id !== room.id) return false;
              const cStart = parseTimeToMinutes(c.hora_inicio);
              const cEnd = parseTimeToMinutes(c.hora_fin);
              return slotStart < cEnd && slotEnd > cStart;
            });
            return !isOccupied;
          });
        });
      }

      if (slots.length > 0) return true;
    }

    return false;
  };

  // 4. Calculate earliest available date for specialist
  const calcularFechaMasProxima = (psicologoId, currentModalidad, localId) => {
    if (!servicioSeleccionado || !currentModalidad) return null;
    const duration = servicioSeleccionado.duracion_minutos || servicioSeleccionado.duracion || 60;
    
    const schedules = dbData.horarios.filter(h => 
      h.empleado_id === psicologoId &&
      h.modalidad === currentModalidad && 
      (currentModalidad === 'Virtual' || h.local_id === localId) &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );
    if (schedules.length === 0) return null;

    let localRooms = [];
    if (currentModalidad === 'Presencial' && localId) {
      localRooms = dbData.rooms.filter(r => r.local_id === localId && r.activo);
      if (localRooms.length === 0) return null;
    }

    const uniqueFechas = [...new Set(schedules.map(h => h.fecha))].sort();

    for (const fecha of uniqueFechas) {
      const schedulesDelDia = schedules.filter(h => h.fecha === fecha);
      const citasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha && c.psicologo_id === psicologoId);
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, duration, BUFFER_MINUTOS);
      
      if (currentModalidad === 'Presencial') {
        const allCitasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha);
        slots = slots.filter(slot => {
          const slotStart = parseTimeToMinutes(slot.inicio);
          const slotEnd = slotStart + duration;

          return localRooms.some(room => {
            const isOccupied = allCitasDelDia.some(c => {
              if (c.habitacion_id !== room.id) return false;
              const cStart = parseTimeToMinutes(c.hora_inicio);
              const cEnd = parseTimeToMinutes(c.hora_fin);
              return slotStart < cEnd && slotEnd > cStart;
            });
            return !isOccupied;
          });
        });
      }

      if (slots.length > 0) return fecha;
    }

    return null;
  };

  // 5. Calculate active dates for a specialist
  const cargarFechasHabilitadas = (psicologoId, currentModalidad, localId) => {
    if (!servicioSeleccionado || !currentModalidad) return new Set();
    const duration = servicioSeleccionado.duracion_minutos || servicioSeleccionado.duracion || 60;
    
    const schedules = dbData.horarios.filter(h => 
      h.empleado_id === psicologoId &&
      h.modalidad === currentModalidad && 
      (currentModalidad === 'Virtual' || h.local_id === localId) &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );

    let localRooms = [];
    if (currentModalidad === 'Presencial' && localId) {
      localRooms = dbData.rooms.filter(r => r.local_id === localId && r.activo);
    }

    const habilitadas = new Set();
    const uniqueFechas = [...new Set(schedules.map(h => h.fecha))];

    for (const fecha of uniqueFechas) {
      const schedulesDelDia = schedules.filter(h => h.fecha === fecha);
      const citasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha && c.psicologo_id === psicologoId);
      
      let slots = obtenerSlotsLibresDia(schedulesDelDia, citasDelDia, duration, BUFFER_MINUTOS);
      
      if (currentModalidad === 'Presencial' && localRooms.length > 0) {
        const allCitasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha);
        slots = slots.filter(slot => {
          const slotStart = parseTimeToMinutes(slot.inicio);
          const slotEnd = slotStart + duration;

          return localRooms.some(room => {
            const isOccupied = allCitasDelDia.some(c => {
              if (c.habitacion_id !== room.id) return false;
              const cStart = parseTimeToMinutes(c.hora_inicio);
              const cEnd = parseTimeToMinutes(c.hora_fin);
              return slotStart < cEnd && slotEnd > cStart;
            });
            return !isOccupied;
          });
        });
      }

      if (slots.length > 0) {
        habilitadas.add(fecha);
      }
    }
    return habilitadas;
  };

  // 6. Get slots for a specific date
  const cargarSlotsDelDia = (psicologoId, fechaStr, currentModalidad, localId) => {
    if (!servicioSeleccionado || !currentModalidad) return [];
    const duration = servicioSeleccionado.duracion_minutos || servicioSeleccionado.duracion || 60;
    
    const schedules = dbData.horarios.filter(h => 
      h.empleado_id === psicologoId &&
      h.modalidad === currentModalidad && 
      h.fecha === fechaStr &&
      (currentModalidad === 'Virtual' || h.local_id === localId) &&
      h.disponible &&
      h.tipo !== 'salida' &&
      h.tipo !== 'otro'
    );

    const citasDelDia = dbData.citas.filter(c => 
      c.fecha_cita === fechaStr && 
      c.psicologo_id === psicologoId
    );

    let slots = obtenerSlotsLibresDia(schedules, citasDelDia, duration, BUFFER_MINUTOS);

    if (currentModalidad === 'Presencial' && localId) {
      const localRooms = dbData.rooms.filter(r => r.local_id === localId && r.activo);
      if (localRooms.length > 0) {
        const allCitasDelDia = dbData.citas.filter(c => c.fecha_cita === fechaStr);
        slots = slots.filter(slot => {
          const slotStart = parseTimeToMinutes(slot.inicio);
          const slotEnd = slotStart + duration;

          return localRooms.some(room => {
            const isOccupied = allCitasDelDia.some(c => {
              if (c.habitacion_id !== room.id) return false;
              const cStart = parseTimeToMinutes(c.hora_inicio);
              const cEnd = parseTimeToMinutes(c.hora_fin);
              return slotStart < cEnd && slotEnd > cStart;
            });
            return !isOccupied;
          });
        });
      }
    }

    return slots;
  };

  // 7. Check if a modality has real availability (Cascading solver)
  const checkModalityAvailability = (mod) => {
    if (mod === 'Presencial') {
      return dbData.locales.some(l => checkLocalAvailability(l.id));
    } else if (mod === 'Virtual') {
      return dbData.servicios.some(s => checkServiceAvailability(s, 'Virtual', null));
    }
    return false;
  };

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------

  // Valid locals passing checkLocalAvailability
  const validLocales = useMemo(() => {
    return dbData.locales.filter(l => checkLocalAvailability(l.id));
  }, [dbData.locales, dbData.horarios, dbData.citas, dbData.rooms, dbData.servicios, dbData.employees, dbData.psicologoServicio]);

  // Set default local if none selected or no longer valid
  useEffect(() => {
    if (modalidad === 'Presencial' && validLocales.length > 0) {
      if (!localSeleccionado || !validLocales.some(l => l.id === localSeleccionado.id)) {
        setLocalSeleccionado(validLocales[0]);
      }
    } else if (modalidad === 'Virtual') {
      setLocalSeleccionado(null);
    }
  }, [modalidad, validLocales, localSeleccionado]);

  // Filter services dynamically by modality, local, search input, and availability
  const serviciosFiltrados = useMemo(() => {
    return dbData.servicios.filter(s => {
      if (buscarServicio.trim() !== '') {
        const query = buscarServicio.toLowerCase();
        if (!s.nombre_servicio.toLowerCase().includes(query) && !(s.descripcion || '').toLowerCase().includes(query)) {
          return false;
        }
      }
      return checkServiceAvailability(s, modalidad, localSeleccionado?.id);
    });
  }, [dbData.servicios, modalidad, localSeleccionado, buscarServicio, dbData.horarios, dbData.citas, dbData.rooms, dbData.employees, dbData.psicologoServicio]);

  // Filter specialists
  const especialistasFiltrados = useMemo(() => {
    if (!servicioSeleccionado) return [];
    return dbData.employees.filter(emp => 
      checkSpecialistAvailability(emp, servicioSeleccionado, modalidad, localSeleccionado?.id)
    );
  }, [dbData.employees, servicioSeleccionado, modalidad, localSeleccionado, dbData.horarios, dbData.citas, dbData.rooms, dbData.psicologoServicio]);

  // Calculate dates proximas for filtered specialists
  const especialistasConFecha = useMemo(() => {
    return especialistasFiltrados.map(emp => {
      const fechaProx = calcularFechaMasProxima(emp.id, modalidad, localSeleccionado?.id);
      return {
        ...emp,
        fechaProx
      };
    }).filter(emp => emp.fechaProx !== null);
  }, [especialistasFiltrados, modalidad, localSeleccionado, dbData.horarios, dbData.citas, dbData.rooms, servicioSeleccionado]);

  // Filter modalities based on availability
  const isPresencialAvailable = useMemo(() => checkModalityAvailability('Presencial'), [dbData]);
  const isVirtualAvailable = useMemo(() => checkModalityAvailability('Virtual'), [dbData]);

  // ----------------------------------------------------
  // NAVIGATION HANDLERS AND CASCADING RESETS
  // ----------------------------------------------------

  const handlePacienteChange = (paraQuienVal, familiarIdVal) => {
    setParaQuien(paraQuienVal);
    setFamiliarId(familiarIdVal);
    
    // Resets:
    setServicioSeleccionado(null);
    setTipoSesion('normal');
    setPaqueteSeleccionado(null);
    setPsicologaSeleccionada(null);
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
  };

  const handleModalidadChange = (nuevaMod) => {
    setModalidad(nuevaMod);
    
    // Resets:
    setLocalSeleccionado(null);
    setServicioSeleccionado(null);
    setTipoSesion('normal');
    setPaqueteSeleccionado(null);
    setPsicologaSeleccionada(null);
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
    
    if (nuevaMod === 'Virtual') {
      setMetodoPago('tarjeta');
    } else {
      setMetodoPago('clinica');
    }
  };

  const handleLocalChange = (nuevoLocal) => {
    setLocalSeleccionado(nuevoLocal);
    
    // Resets:
    setServicioSeleccionado(null);
    setTipoSesion('normal');
    setPaqueteSeleccionado(null);
    setPsicologaSeleccionada(null);
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
  };

  const handleServicioChange = (nuevoServicio) => {
    setServicioSeleccionado(nuevoServicio);
    
    // Resets:
    setTipoSesion('normal');
    setPaqueteSeleccionado(null);
    setPsicologaSeleccionada(null);
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
  };

  const handleTipoSesionChange = (nuevoTipo) => {
    setTipoSesion(nuevoTipo);
    
    // Resets:
    setPaqueteSeleccionado(null);
    setPsicologaSeleccionada(null);
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
  };

  const handlePaqueteChange = (nuevoPaquete) => {
    setPaqueteSeleccionado(nuevoPaquete);
    
    // Resets:
    setPsicologaSeleccionada(null);
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
  };

  const handleEspecialistaChange = (nuevoEspecialista) => {
    setPsicologaSeleccionada(nuevoEspecialista);
    
    // Resets:
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
  };

  const puedesAvanzar = () => {
    const currentStepId = steps[stepIndex]?.id;
    if (currentStepId === 'paciente') {
      if (paraQuien === 'yo') return !esClinicoIncompletoYo;
      return familiarId !== '' && !esClinicoIncompletoFamiliar;
    }
    if (currentStepId === 'modalidad') {
      return modalidad === 'Presencial' || modalidad === 'Virtual';
    }
    if (currentStepId === 'local') {
      return localSeleccionado !== null;
    }
    if (currentStepId === 'servicio_tipo') {
      if (!servicioSeleccionado) return false;
      if (tipoSesion === 'normal') return true;
      return paqueteSeleccionado !== null;
    }
    if (currentStepId === 'especialista') {
      return psicologaSeleccionada !== null;
    }
    if (currentStepId === 'horario') {
      return fechaSeleccionada !== null && slotSeleccionado !== null;
    }
    return true;
  };

  const nextStep = () => {
    if (puedesAvanzar()) {
      const targetIndex = stepIndex + 1;
      if (targetIndex < steps.length) {
        const nextStepId = steps[targetIndex].id;

        if (nextStepId === 'horario') {
          if (psicologaSeleccionada) {
            const enabled = cargarFechasHabilitadas(psicologaSeleccionada.id, modalidad, activeLocal?.id);
            setFechasHabilitadas(enabled);
          }
          setFechaSeleccionada(null);
          setSlotSeleccionado(null);
          setSlotsDisponibles([]);
        }

        if (nextStepId === 'pago') {
          setTempComentario(comentario);
          setShowCommentsModal(true);
          return; // Modal will set the stepIndex to payment when done
        }

        setStepIndex(targetIndex);
      }
    }
  };

  const prevStep = () => {
    const targetIndex = stepIndex - 1;
    if (targetIndex >= 0) {
      setStepIndex(targetIndex);
    }
  };

  // ----------------------------------------------------
  // SUBMISSION LOGIC
  // ----------------------------------------------------

  const saveAppointment = async (estadoPago, metodoPagoVal) => {
    setSavingAppointment(true);
    setBookingError('');
    try {
      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio.id_paciente : familiarId;
      const dateStr = formatDateStr(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate());

      let dbMetodoPago = metodoPagoVal;
      if (metodoPagoVal === 'Pago en clínica') {
        dbMetodoPago = 'Pago en Clínica';
      } else if (metodoPagoVal === 'Online (Culqi)' || metodoPagoVal === 'Pago Online') {
        dbMetodoPago = 'Pago Online';
      }

      if (paqueteSeleccionado && paqueteSeleccionado.type === 'adquirido') {
        const { data: dbPack, error: dbPackErr } = await supabase
          .from('paquetes_adquiridos')
          .select('sesiones_disponibles')
          .eq('id', paqueteSeleccionado.id)
          .single();

        if (dbPackErr || !dbPack) {
          throw new Error('No se pudo encontrar el paquete adquirido especificado.');
        }

        const { count: pendingCount, error: countErr } = await supabase
          .from('citas')
          .select('*', { count: 'exact', head: true })
          .eq('paquete_id', paqueteSeleccionado.id)
          .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

        if (countErr) {
          throw new Error('Error al validar las citas pendientes del paquete.');
        }

        const netas = dbPack.sesiones_disponibles - (pendingCount || 0);
        if (netas <= 0) {
          throw new Error('Ya no te quedan sesiones disponibles netas en este paquete (hay citas pendientes que consumen tu saldo).');
        }
      }

      let dbPaqueteId = null;
      if (paqueteSeleccionado) {
        if (paqueteSeleccionado.type === 'adquirido') {
          dbPaqueteId = paqueteSeleccionado.id;
        } else {
          const sesionesTotales = Number(
            paqueteSeleccionado?.cantidad_sesiones ??
            paqueteSeleccionado?.cant_sesiones ??
            paqueteSeleccionado?.sesiones_totales
          );

          if (!sesionesTotales || sesionesTotales <= 0) {
            throw new Error('El paquete seleccionado no tiene una cantidad de sesiones válida.');
          }

          const montoPagado = Number(
            paqueteSeleccionado?.precio_total ??
            paqueteSeleccionado?.monto_pagado ??
            0
          );

          const { data: newPack, error: packErr } = await supabase
            .from('paquetes_adquiridos')
            .insert([{
              paciente_id: pacienteId,
              servicio_id: servicioSeleccionado.id,
              paquete_catalogo_id: paqueteSeleccionado.id,
              nombre_paquete_snapshot: paqueteSeleccionado.nombre_paquete,
              sesiones_totales: sesionesTotales,
              sesiones_disponibles: sesionesTotales,
              monto_pagado: montoPagado,
              metodo_pago: dbMetodoPago
            }])
            .select()
            .single();

          if (packErr) {
            throw new Error('Error al registrar la compra del paquete: ' + packErr.message);
          }
          dbPaqueteId = newPack.id;
        }
      }

      const priceVal = paqueteSeleccionado
        ? (paqueteSeleccionado.type === 'adquirido' ? 0 : paqueteSeleccionado.precio_total)
        : servicioSeleccionado.precio_sesion;

      let dbHabitacionId = null;
      if (modalidad === 'Presencial' && activeLocal) {
        const { data: roomsData } = await supabase
          .from('habitaciones')
          .select('*')
          .eq('local_id', activeLocal.id)
          .eq('activo', true);
        const localRooms = roomsData || [];

        if (localRooms.length > 0) {
          const { data: allCitasDelDia } = await supabase
            .from('citas')
            .select('hora_inicio, hora_fin, habitacion_id')
            .eq('fecha_cita', dateStr)
            .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

          const duracion = servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 60;
          const slotStart = parseTimeToMinutes(slotSeleccionado.hora_inicio);
          const slotEnd = slotStart + duracion;

          const assignedRoom = localRooms.find(room => {
            const isOccupied = (allCitasDelDia || []).some(c => {
              if (c.habitacion_id !== room.id) return false;
              const cStart = parseTimeToMinutes(c.hora_inicio);
              const cEnd = parseTimeToMinutes(c.hora_fin);
              return slotStart < cEnd && slotEnd > cStart;
            });
            return !isOccupied;
          });

          dbHabitacionId = assignedRoom ? assignedRoom.id : localRooms[0].id;
        }
      }

      const cita = {
        paciente_id: pacienteId,
        psicologo_id: psicologaSeleccionada.id,
        psicologa_nombre: psicologaSeleccionada.nombres_apellidos,
        servicio: servicioSeleccionado.nombre_servicio,
        numero_sesion: 1,
        fecha_cita: dateStr,
        hora_inicio: slotSeleccionado.hora_inicio,
        hora_fin: slotSeleccionado.hora_fin,
        estado_cita: 'Pendiente',
        estado_pago: estadoPago,
        metodo_pago: dbMetodoPago,
        monto: priceVal,
        comentario_paciente: comentario,
        paquete_id: dbPaqueteId,
        modalidad: modalidad,
        habitacion_id: dbHabitacionId
      };

      const res = await crearCita(cita);
      return res;
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    } finally {
      setSavingAppointment(false);
    }
  };

  const handleConfirmarReserva = async () => {
    if (paqueteSeleccionado?.type === 'adquirido') {
      const res = await saveAppointment('Pagado', paqueteSeleccionado.metodo_pago);
      if (res.success) {
        alert('Cita agendada correctamente utilizando tu paquete.');
        navigate('/dashboard/appointments');
      } else {
        setBookingError(res.error || 'Error al guardar la cita.');
      }
    } else if (metodoPago === 'tarjeta') {
      const res = await saveAppointment('Pendiente', 'Pago Online');
      if (res.success) {
        setPaymentModalRedirectOnClose(true);
        setShowPaymentModal(true);
      } else {
        setBookingError(res.error || 'Error al guardar la cita.');
      }
    } else {
      const res = await saveAppointment('Pendiente', 'Pago en clínica');
      if (res.success) {
        alert('Cita agendada correctamente. Recuerda realizar el pago en recepción el día de tu consulta.');
        navigate('/dashboard/appointments');
      } else {
        setBookingError(res.error || 'Error al guardar la cita.');
      }
    }
  };

  // ----------------------------------------------------
  // HELPERS AND CONTROLS
  // ----------------------------------------------------

  const getPsicoFoto = (id) => {
    if (id === 'a1f981b3-30fd-4ba8-80da-c32f4f5b1b51') return '/dr_valeria.png';
    if (id === 'a1f981b3-30fd-4ba8-80da-c32f4f5b1b52') return '/mg_beatriz.png';
    if (id === 'a1f981b3-30fd-4ba8-80da-c32f4f5b1b53') return '/lic_camila.png';
    if (id === '0f7d4b9e-b74f-4d66-a052-4773fbb8c6ca') return '/Doctora Milagros Ordinola.jpeg';
    if (id === '86bacf53-dd77-4899-bf11-f6f7b3cbf940') return '/Licenciada Karina.jpeg';
    if (id === '17946652-05c2-4d7c-9d8b-37dd2147eba2') return '/Magister Williams.jpeg';
    if (id === 'c4c6e1f8-a03b-457f-afb3-4546be2ec895') return '/Licenciada Jasmin Pillaca.jpeg';
    return null;
  };

  const cambiarMes = (incremento) => {
    const nueva = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    nueva.setMonth(nueva.getMonth() + incremento);
    setCalendarMonth(nueva);
  };

  const copyToClipboard = async (key, value) => {
    if (!value) return;
    try {
      const cleanValue = String(value).replace(/\s+/g, '');
      await navigator.clipboard.writeText(cleanValue);
      setCopiedField(key);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (error) {
      console.error('No se pudo copiar:', error);
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
  };

  const renderStepIndicator = () => {
    return (
      <div className="mb-10">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          {steps.map((s, idx) => {
            const isCompleted = stepIndex > idx;
            const isActive = stepIndex === idx;
            return (
              <Fragment key={s.id}>
                <div className="flex flex-col items-center relative flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    isCompleted
                      ? 'bg-[#003178] border-[#003178] text-white'
                      : isActive
                        ? 'bg-blue-50 border-[#003178] text-[#003178] font-black'
                        : 'bg-white border-gray-200 text-gray-400'
                  }`}>
                    {isCompleted ? <span className="material-symbols-outlined text-[16px]">check</span> : idx + 1}
                  </div>
                  <span className={`text-[10px] md:text-xs font-semibold mt-2 text-center absolute -bottom-6 w-24 ${
                    isActive ? 'text-[#003178] font-bold font-sans' : 'text-gray-400 font-sans'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`h-[2px] flex-1 transition-all ${
                    stepIndex > idx ? 'bg-[#003178]' : 'bg-gray-200'
                  }`} />
                )}
              </Fragment>
            );
          })}
        </div>
        <div className="h-6" />
      </div>
    );
  };

  const renderAppointmentSummary = (isMobile = false) => {
    let pacienteNombre = '-';
    if (paraQuien === 'yo') {
      const nameYo = perfilClinicoPropio
        ? `${perfilClinicoPropio.nombres} ${perfilClinicoPropio.apellido_paterno} ${perfilClinicoPropio.apellido_materno || ''}`.trim()
        : `${perfilUsuario?.nombres} ${perfilUsuario?.apellido_paterno} ${perfilUsuario?.apellido_materno || ''}`.trim();
      pacienteNombre = `${nameYo} (Yo)`;
    } else if (paraQuien === 'familiar' && familiarId) {
      const dep = perfilesDependientes.find(d => d.id_paciente === familiarId);
      pacienteNombre = dep
        ? `${dep.nombres} ${dep.apellido_paterno} ${dep.apellido_materno || ''}`.trim()
        : '-';
    }

    const modNombre = modalidad || '-';
    
    let localNombre = '-';
    if (modalidad === 'Virtual') {
      localNombre = 'No aplica';
    } else if (localSeleccionado) {
      localNombre = localSeleccionado.nombre;
    }

    const servicioNombre = servicioSeleccionado?.nombre_servicio || '-';
    
    let formaReserva = '-';
    if (servicioSeleccionado) {
      if (tipoSesion === 'normal') {
        formaReserva = 'Sesión Individual';
      } else if (tipoSesion === 'paquete' && paqueteSeleccionado) {
        formaReserva = paqueteSeleccionado.type === 'adquirido' 
          ? `Paquete Adquirido (${paqueteSeleccionado.nombre_paquete_snapshot || paqueteSeleccionado.nombre_paquete})`
          : `Comprar Paquete (${paqueteSeleccionado.nombre_paquete})`;
      }
    }

    const especialistaNombre = psicologaSeleccionada?.nombres_apellidos || '-';
    
    let fechaHoraStr = '-';
    if (fechaSeleccionada && slotSeleccionado) {
      fechaHoraStr = `${fechaSeleccionada.toLocaleDateString('es-PE')} a las ${slotSeleccionado.inicio}`;
    }

    let price = '-';
    if (servicioSeleccionado) {
      const calculatedPrice = paqueteSeleccionado
        ? (paqueteSeleccionado.type === 'adquirido' ? 0 : paqueteSeleccionado.precio_total)
        : servicioSeleccionado.precio_sesion;
      price = `S/ ${calculatedPrice}`;
    }

    const summaryItems = [
      { label: 'Paciente', value: pacienteNombre, active: pacienteNombre !== '-' },
      { label: 'Modalidad', value: modNombre, active: modNombre !== '-' },
    ];

    if (modalidad !== 'Virtual') {
      summaryItems.push({ label: 'Sede / Local', value: localNombre, active: localNombre !== '-' });
    }

    summaryItems.push(
      { label: 'Servicio', value: servicioNombre, active: servicioNombre !== '-' },
      { label: 'Forma de Reserva', value: formaReserva, active: formaReserva !== '-' },
      { label: 'Especialista', value: especialistaNombre, active: especialistaNombre !== '-' },
      { label: 'Fecha y Hora', value: fechaHoraStr, active: fechaHoraStr !== '-' },
      { label: 'Monto estimado', value: price, active: price !== '-' }
    );

    return (
      <div className={`bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-left ${isMobile ? 'mb-6' : ''}`}>
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 border-b pb-2 font-sans">
          Resumen de Reserva
        </h3>
        <div className="divide-y divide-gray-100">
          {summaryItems.map((item, idx) => (
            <div key={idx} className="py-2.5 flex justify-between gap-4 text-xs">
              <span className="text-gray-400 font-semibold uppercase tracking-wider">{item.label}</span>
              <span className={`text-right font-sans font-bold ${
                item.active ? 'text-[#003178]' : 'text-gray-300'
              }`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // CALENDAR DAYS (SYNCHRONOUS)
  // ----------------------------------------------------

  const renderDias = () => {
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {diasSemana.map(d => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
          {dias.map((d, idx) => {
            if (!d) return <div key={`empty-${idx}`} />;

            const dateStr = formatDateStr(año, mes, d);
            const isEnabled = fechasHabilitadas.has(dateStr);
            const isSelected = fechaSeleccionada &&
              fechaSeleccionada.getFullYear() === año &&
              fechaSeleccionada.getMonth() === mes &&
              fechaSeleccionada.getDate() === d;

            return (
              <button
                key={`day-${d}`}
                type="button"
                disabled={!isEnabled}
                onClick={() => {
                  const newDate = new Date(año, mes, d);
                  setFechaSeleccionada(newDate);
                  const slots = cargarSlotsDelDia(psicologaSeleccionada.id, dateStr, modalidad, activeLocal?.id);
                  setSlotsDisponibles(slots);
                  setSlotSeleccionado(null);
                }}
                className={`py-2.5 rounded-xl font-bold transition-all ${isSelected
                  ? 'bg-[#003178] text-white shadow-sm font-sans'
                  : isEnabled
                    ? 'bg-blue-50/60 hover:bg-blue-100/70 text-gray-900 border border-blue-100 cursor-pointer font-sans'
                    : 'bg-gray-55 text-gray-300 border border-gray-100 cursor-not-allowed opacity-50 font-sans'
                  }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // STEP CONTENT RENDERERS
  // ----------------------------------------------------

  const renderPaciente = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${paraQuien === 'yo'
              ? 'border-[#003178] bg-blue-50/40 shadow-sm'
              : 'border-gray-200 hover:bg-gray-55'
              }`}
            onClick={() => handlePacienteChange('yo', '')}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${paraQuien === 'yo' ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                <span className="material-symbols-outlined">account_circle</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm font-sans">Cita para mí</p>
                <p className="text-xs text-gray-500 mt-0.5">Reservar usando mi ficha clínica</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${paraQuien === 'familiar'
              ? 'border-[#003178] bg-blue-50/40 shadow-sm'
              : 'border-gray-200 hover:bg-gray-55'
              }`}
            onClick={() => handlePacienteChange('familiar', '')}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${paraQuien === 'familiar' ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                <span className="material-symbols-outlined">groups</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm font-sans">Cita para otro miembro</p>
                <p className="text-xs text-gray-500 mt-0.5">Hijo, pareja o familiar dependiente</p>
              </div>
            </div>
          </button>
        </div>

        {paraQuien === 'yo' && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left">
            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-3 font-sans">Datos del Titular</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Nombre Completo</p>
                <p className="font-semibold text-slate-900">{perfilUsuario?.nombres} {perfilUsuario?.apellido_paterno} {perfilUsuario?.apellido_materno}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">DNI / Documento</p>
                <p className="font-semibold text-slate-900">{perfilUsuario?.dni}</p>
              </div>
            </div>

            {esClinicoIncompletoYo && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl flex gap-3">
                <span className="material-symbols-outlined text-red-500 text-[20px] shrink-0 mt-0.5">warning</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">Ficha Clínica Incompleta</p>
                  <p className="text-xs text-red-600 mt-1 leading-relaxed">
                    Para agendar una cita debes completar primero tu información clínica.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/profile')}
                    className="mt-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    Perfil
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {paraQuien === 'familiar' && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 text-left">
            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider font-sans">Seleccionar Miembro Dependiente</h4>

            {perfilesDependientes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500 mb-3">No tienes ningún miembro dependiente registrado en esta cuenta.</p>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/family')}
                  className="bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  Agregar Miembro Dependiente
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Familiar *</label>
                  <select
                    value={familiarId}
                    onChange={e => handlePacienteChange('familiar', e.target.value)}
                    className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm focus:border-[#003178] outline-none text-gray-700"
                  >
                    <option value="">Selecciona un miembro...</option>
                    {perfilesDependientes.map(dep => (
                      <option key={dep.id_paciente} value={dep.id_paciente}>
                        {dep.nombres} {dep.apellido_paterno} ({dep.parentesco}) - DNI: {dep.dni}
                      </option>
                    ))}
                  </select>
                </div>

                {familiarId && esClinicoIncompletoFamiliar && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl flex gap-3">
                    <span className="material-symbols-outlined text-red-500 text-[20px] shrink-0 mt-0.5">warning</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide">Ficha Clínica Incompleta del Familiar</p>
                      <p className="text-xs text-red-600 mt-1 leading-relaxed">
                        Para agendar una cita para este familiar, primero debes completar los campos obligatorios de su ficha clínica (dirección, género, ubigeo para Perú, etc.) en "Miembros".
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/family')}
                        className="mt-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        Completar Datos del Familiar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderModalidad = () => {
    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2 text-left">Seleccionar Modalidad</h4>
        
        {!isPresencialAvailable && !isVirtualAvailable ? (
          <div className="p-4 bg-red-55 border border-red-200 text-red-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            No hay disponibilidad en el sistema en este momento. Inténtelo más tarde.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isPresencialAvailable && (
              <button
                type="button"
                className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${
                  modalidad === 'Presencial' ? 'border-[#003178] bg-blue-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-55'
                }`}
                onClick={() => handleModalidadChange('Presencial')}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
                    modalidad === 'Presencial' ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className="material-symbols-outlined">storefront</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-900 text-sm font-sans">Atención Presencial</h5>
                    <p className="text-xs text-gray-500 mt-0.5">Asiste a nuestros consultorios físicos</p>
                  </div>
                </div>
              </button>
            )}
            
            {isVirtualAvailable && (
              <button
                type="button"
                className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${
                  modalidad === 'Virtual' ? 'border-[#003178] bg-blue-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-55'
                }`}
                onClick={() => handleModalidadChange('Virtual')}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
                    modalidad === 'Virtual' ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className="material-symbols-outlined">videocam</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-900 text-sm font-sans">Atención Virtual</h5>
                    <p className="text-xs text-gray-555 mt-0.5">Sesión online mediante videollamada</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLocal = () => {
    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2 text-left">Seleccionar Local</h4>
        {validLocales.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            No hay locales disponibles con horarios libres en modalidad presencial.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {validLocales.map(l => {
              const isSelected = localSeleccionado?.id === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${
                    isSelected ? 'border-[#003178] bg-blue-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-55'
                  }`}
                  onClick={() => handleLocalChange(l)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                      isSelected ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className="material-symbols-outlined">storefront</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-gray-900 text-base font-sans">{l.nombre}</h5>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{l.direccion || 'Dirección de sede'}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderServicioTipo = () => {
    const hasPacks = paquetes.length > 0 || paquetesAdquiridos.length > 0;

    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2 text-left">Servicios Disponibles</h4>
        
        {/* Filters Panel */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filter 1: Search Service */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Buscar servicio</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej. Terapia Infantil, Ansiedad..."
                  value={buscarServicio}
                  onChange={(e) => setBuscarServicio(e.target.value)}
                  className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm focus:border-[#003178] outline-none text-gray-700 font-medium pl-10"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              </div>
            </div>

            {/* Filter 2: Local selector (Only for Presencial) */}
            {modalidad === 'Presencial' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Local</label>
                <select
                  value={localSeleccionado?.id || ''}
                  onChange={(e) => {
                    const loc = dbData.locales.find(l => l.id === e.target.value);
                    if (loc) handleLocalChange(loc);
                  }}
                  className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm focus:border-[#003178] outline-none text-gray-700 font-semibold"
                >
                  {validLocales.map(l => (
                    <option key={l.id} value={l.id}>{l.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Services grid */}
        {serviciosFiltrados.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-6 text-center">
            No hay servicios disponibles que cumplan con los filtros de búsqueda y disponibilidad.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviciosFiltrados.map(s => {
              const isSelected = servicioSeleccionado?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${isSelected
                    ? 'border-[#003178] bg-blue-50/40 shadow-sm'
                    : 'border-gray-205 hover:bg-gray-50'
                    }`}
                  onClick={() => handleServicioChange(s)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-bold text-gray-900 text-base font-sans">{s.nombre_servicio}</h5>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.descripcion || 'Sin descripción'}</p>
                      <p className="text-xs text-[#003178] font-bold mt-2">Duración: {s.duracion_minutos || 50} min</p>
                    </div>
                    <span className="text-lg font-black text-[#003178] shrink-0 ml-4">S/ {s.precio_sesion}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Opciones de reserva (embedded) */}
        {servicioSeleccionado && (
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-4 text-left">
            <h5 className="font-bold text-sm text-slate-800 uppercase tracking-wider font-sans">
              Forma de Reserva para: {servicioSeleccionado.nombre_servicio}
            </h5>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Normal session */}
              <button
                type="button"
                className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${
                  tipoSesion === 'normal' ? 'border-[#003178] bg-blue-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => handleTipoSesionChange('normal')}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
                    tipoSesion === 'normal' ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm font-sans font-semibold">Sesión Individual</p>
                    <p className="text-xs text-gray-555 mt-0.5">Paga solo por la sesión programada</p>
                    <p className="text-sm font-black text-[#003178] mt-2">S/ {servicioSeleccionado.precio_sesion}</p>
                  </div>
                </div>
              </button>

              {/* Package session (only shown if there are packages available) */}
              {hasPacks && (
                <button
                  type="button"
                  className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${
                    tipoSesion === 'paquete' ? 'border-[#003178] bg-blue-50/40 shadow-sm' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => handleTipoSesionChange('paquete')}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${
                      tipoSesion === 'paquete' ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className="material-symbols-outlined">inventory_2</span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm font-sans font-semibold">Sesión con Paquete</p>
                      <p className="text-xs text-gray-555 mt-0.5">Usa o adquiere un paquete de sesiones</p>
                      <p className="text-xs text-[#003178] font-bold mt-2 font-sans">Tarifas con descuento</p>
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Packages list display */}
            {tipoSesion === 'paquete' && hasPacks && (
              <div className="bg-slate-55 border border-slate-200 rounded-2xl p-5 space-y-5">
                {/* Prepaid acquired packages */}
                {paquetesAdquiridos.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Tus Paquetes Adquiridos Disponibles (Pre-pagados)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {paquetesAdquiridos.map(p => {
                        const isSelected = paqueteSeleccionado?.id === p.id && paqueteSeleccionado?.type === 'adquirido';
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`p-4 rounded-xl border text-left bg-white cursor-pointer transition-all ${
                              isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm' : 'border-emerald-200 hover:bg-emerald-50/30'
                            }`}
                            onClick={() => handlePaqueteChange({ ...p, type: 'adquirido' })}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-sm text-emerald-900 font-sans">{p.nombre_paquete_snapshot || 'Paquete Adquirido'}</p>
                                <p className="text-xs text-emerald-700 mt-0.5">
                                  {p.sesiones_netas} {p.sesiones_netas === 1 ? 'sesión neta disponible' : 'sesiones netas disponibles'}
                                </p>
                              </div>
                              <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0 font-sans">Usar</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Catalog packages */}
                {paquetes.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
                      Adquirir Nuevo Paquete
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {paquetes.map(p => {
                        const isSelected = paqueteSeleccionado?.id === p.id && paqueteSeleccionado?.type !== 'adquirido';
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`p-4 rounded-xl border text-left bg-white cursor-pointer transition-all ${
                              isSelected ? 'border-[#003178] ring-1 ring-[#003178] shadow-sm' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => handlePaqueteChange({ ...p, type: 'catalogo' })}
                          >
                            <p className="font-bold text-sm text-gray-900 font-sans">{p.nombre_paquete}</p>
                            <p className="text-xs text-gray-505 mt-0.5">{p.cantidad_sesiones ?? p.cant_sesiones} sesiones incluidas</p>
                            <p className="text-sm font-black text-[#003178] mt-2">S/ {p.precio_total}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderEspecialista = () => {
    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2 text-left">Especialistas para este Servicio</h4>

        {especialistasConFecha.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-55 border rounded-xl p-6 text-center">
            No hay especialistas con horarios libres disponibles para este servicio en los próximos días.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Show only real specialists */}
            {especialistasConFecha.map(p => {
              const isSelected = psicologaSeleccionada?.id === p.id;
              const foto = getPsicoFoto(p.id) || '/default_perfil psicologia.jpeg';

              return (
                <button
                  key={p.id}
                  type="button"
                  className={`flex flex-col bg-white rounded-2xl border overflow-hidden text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#003178] ring-2 ring-blue-50/50 shadow-md animate-in fade-in duration-100'
                      : 'border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                  }`}
                  onClick={() => handleEspecialistaChange(p)}
                >
                  <div className="h-44 w-full overflow-hidden bg-gray-100 relative">
                    <img src={foto} alt={p.nombres_apellidos} className="w-full h-full object-cover object-top" />
                    {isSelected && (
                      <div className="absolute top-3 right-3 bg-[#003178] text-white rounded-full p-1 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h5 className="font-bold text-gray-900 text-sm leading-tight font-sans">{p.nombres_apellidos}</h5>
                      <p className="text-xs text-gray-400 mt-1">{p.correo || 'Especialista CEPSITCED'}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#003178] text-[16px]">calendar_today</span>
                      <span className="text-[11px] font-bold text-[#003178] font-sans">
                        Disponible desde: {new Date(p.fechaProx + 'T00:00:00').toLocaleDateString('es-PE')}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Validation message if no specialist is selected */}
        {!psicologaSeleccionada && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2 mt-4 text-left">
            <span className="material-symbols-outlined text-[16px]">info</span>
            Selecciona una especialista para continuar.
          </div>
        )}
      </div>
    );
  };

  const renderHorario = () => {
    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2 text-left">Seleccionar Fecha y Horario</h4>

        {fechasHabilitadas.size === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-center gap-2 text-left">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            No hay disponibilidad para esta modalidad con la especialista seleccionada.
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Calendar side */}
          <div className="h-[430px] max-h-[430px] bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-0 overflow-hidden">
            <div>
              <div className="flex justify-between items-center mb-6">
                <button
                  type="button"
                  onClick={() => cambiarMes(-1)}
                  className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <span className="font-bold text-sm text-slate-800 uppercase tracking-wider font-sans">
                  {calendarMonth.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => cambiarMes(1)}
                  className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>

              {renderDias()}
            </div>

            {fechaSeleccionada && (
              <div className="mt-6 pt-4 border-t border-slate-200 text-center">
                <p className="text-xs text-gray-400">Fecha seleccionada</p>
                <p className="font-bold text-sm text-[#003178] mt-1 capitalize font-sans">
                  {fechaSeleccionada.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* Slots side */}
          <div className="h-[430px] max-h-[430px] flex flex-col min-h-0 w-full">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col min-h-0 h-full">
              <h5 className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-wider shrink-0 font-sans text-left">Horarios Disponibles</h5>
              {!fechaSeleccionada ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-gray-500 bg-white border border-gray-150 rounded-xl p-4 text-center w-full">
                    Selecciona una fecha en el calendario para ver los horarios.
                  </p>
                </div>
              ) : slotsDisponibles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-gray-550 bg-white border border-gray-150 rounded-xl p-4 text-center w-full">
                    No hay horarios libres para esta fecha.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1 min-h-0">
                  {slotsDisponibles.map(slot => {
                    const isSelected = slotSeleccionado?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs cursor-pointer h-10 flex items-center justify-center transition-all ${isSelected
                            ? 'bg-[#003178] border-[#003178] text-white shadow-sm font-sans'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                          }`}
                        onClick={() => setSlotSeleccionado(slot)}
                      >
                        {slot.inicio} - {slot.fin}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPago = () => {
    let pacienteNombre;
    if (paraQuien === 'yo') {
      const nameYo = perfilClinicoPropio
        ? `${perfilClinicoPropio.nombres} ${perfilClinicoPropio.apellido_paterno} ${perfilClinicoPropio.apellido_materno || ''}`.trim()
        : `${perfilUsuario?.nombres} ${perfilUsuario?.apellido_paterno} ${perfilUsuario?.apellido_materno || ''}`.trim();
      pacienteNombre = `${nameYo} (Yo)`;
    } else {
      const dep = perfilesDependientes.find(d => d.id_paciente === familiarId);
      pacienteNombre = dep
        ? `${dep.nombres} ${dep.apellido_paterno} ${dep.apellido_materno || ''}`.trim()
        : '';
    }

    const price = paqueteSeleccionado
      ? (paqueteSeleccionado.type === 'adquirido' ? 0 : paqueteSeleccionado.precio_total)
      : servicioSeleccionado?.precio_sesion;

    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2 text-left">Confirmación y Pago</h4>

        {bookingError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2 text-left">
            <span className="material-symbols-outlined text-red-500">error</span>
            {bookingError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Summary Details */}
          <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm text-left">
            <h5 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 font-sans">Resumen de la Cita</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Paciente</p>
                <p className="font-bold text-slate-800 mt-0.5">{pacienteNombre}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Especialista</p>
                <p className="font-bold text-slate-800 mt-0.5">
                  {psicologaSeleccionada?.nombres_apellidos}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Servicio</p>
                <p className="font-bold text-[#003178] mt-0.5 font-sans">{servicioSeleccionado?.nombre_servicio}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Modalidad</p>
                <p className="font-bold text-slate-800 mt-0.5 capitalize">{modalidad}</p>
              </div>
              {modalidad === 'Presencial' && (
                <div>
                  <p className="text-xs text-gray-400">Ubicación / Local</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {activeLocal?.nombre || 'Local Central'}
                  </p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Fecha y Hora</p>
                <p className="font-bold text-slate-800 mt-0.5">
                  {fechaSeleccionada?.toLocaleDateString('es-PE')} de {slotSeleccionado?.hora_inicio.slice(0, 5)} a {slotSeleccionado?.hora_fin.slice(0, 5)}
                </p>
              </div>
              {comentario && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Observación</p>
                  <p className="text-xs text-gray-600 mt-0.5 italic">"{comentario}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Side */}
          {paqueteSeleccionado?.type === 'adquirido' ? (
            <div className="md:col-span-5 space-y-4 text-left">
              <h5 className="font-bold text-sm text-slate-700 mb-3 font-sans">Método de Pago</h5>
              <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl flex gap-3 shadow-sm">
                <span className="material-symbols-outlined text-emerald-600 text-[24px] shrink-0">check_circle</span>
                <div>
                  <p className="font-bold text-sm">Sesión Pre-pagada</p>
                  <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                    Se utilizará una sesión de tu paquete "{paqueteSeleccionado.nombre_paquete_snapshot || paqueteSeleccionado.nombre_paquete}".
                  </p>
                  <p className="text-[10px] text-emerald-600 font-bold mt-1.5 uppercase">
                    Método de pago: {paqueteSeleccionado.metodo_pago}
                  </p>
                </div>
              </div>
              <div className="bg-[#003178]/5 border border-[#003178]/10 rounded-2xl p-4 flex justify-between items-center mt-6">
                <span className="font-bold text-sm text-slate-700">Total a pagar:</span>
                <span className="text-2xl font-black text-[#003178]">S/ 0</span>
              </div>
            </div>
          ) : (
            <div className="md:col-span-5 space-y-4 text-left">
              <h5 className="font-bold text-sm text-slate-700 mb-3 font-sans">Selecciona el Método de Pago</h5>

              <div className="flex flex-col gap-3">
                <label className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all ${metodoPago === 'clinica'
                  ? 'border-[#003178] bg-blue-50/20 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50'
                  } ${modalidad === 'Virtual' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="radio"
                    name="metodoPago"
                    value="clinica"
                    disabled={modalidad === 'Virtual'}
                    checked={metodoPago === 'clinica'}
                    onChange={() => setMetodoPago('clinica')}
                    className="w-4 h-4 text-[#003178] focus:ring-[#003178]"
                  />
                  <div className="ml-3 flex-1">
                    <p className="font-bold text-sm text-gray-900 font-sans">Pago en Clínica</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">Paga en la recepción física el día de tu cita</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[24px]">storefront</span>
                </label>

                <label className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all ${metodoPago === 'tarjeta'
                  ? 'border-[#003178] bg-blue-50/20 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="metodoPago"
                    value="tarjeta"
                    checked={metodoPago === 'tarjeta'}
                    onChange={() => setMetodoPago('tarjeta')}
                    className="w-4 h-4 text-[#003178] focus:ring-[#003178]"
                  />
                  <div className="ml-3 flex-1">
                    <p className="font-bold text-sm text-gray-900 font-sans">Pago Online</p>
                    <p className="text-xs text-gray-505 mt-0.5">Transferencia bancaria o Yape</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[24px]">credit_card</span>
                </label>
              </div>

              {metodoPago === 'tarjeta' && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full py-3 px-4 border border-[#003178] text-[#003178] hover:bg-blue-50/50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Ver datos de pago
                  </button>
                </div>
              )}

              {modalidad === 'Virtual' && (
                <p className="text-[11px] text-amber-600 font-bold mt-1">
                  * Para consultas virtuales, solo se permite Pago Online.
                </p>
              )}

              <div className="bg-[#003178]/5 border border-[#003178]/10 rounded-2xl p-4 flex justify-between items-center mt-6">
                <span className="font-bold text-sm text-slate-700">Total a pagar:</span>
                <span className="text-2xl font-black text-[#003178]">S/ {price}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getEmailDefault = () => {
    const isSystemEmail = (email) => {
      if (!email) return true;
      return email.toLowerCase().includes('@sistema.cepsitced.local');
    };

    if (paraQuien === 'yo') {
      if (perfilClinicoPropio?.correo && !isSystemEmail(perfilClinicoPropio.correo)) {
        return perfilClinicoPropio.correo;
      }
      if (perfilUsuario?.correo && !isSystemEmail(perfilUsuario.correo)) {
        return perfilUsuario.correo;
      }
    } else if (paraQuien === 'familiar') {
      const dep = perfilesDependientes.find(d => d.id_paciente === familiarId);
      if (dep?.correo && !isSystemEmail(dep.correo)) {
        return dep.correo;
      }
      if (perfilClinicoPropio?.correo && !isSystemEmail(perfilClinicoPropio.correo)) {
        return perfilClinicoPropio.correo;
      }
      if (perfilUsuario?.correo && !isSystemEmail(perfilUsuario.correo)) {
        return perfilUsuario.correo;
      }
    }
    return '';
  };

  // ----------------------------------------------------
  // DATE SOLVER VARIABLES
  // ----------------------------------------------------

  const { año, mes, dias } = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const diasEnMes = new Date(y, m + 1, 0).getDate();
    const primerDia = new Date(y, m, 1).getDay();

    const d = [];
    for (let i = 0; i < primerDia; i++) d.push(null);
    for (let dNum = 1; dNum <= diasEnMes; dNum++) d.push(dNum);

    return { año: y, mes: m, dias: d };
  }, [calendarMonth]);

  const currentStepId = steps[stepIndex]?.id;

  // ----------------------------------------------------
  // APP RENDERING
  // ----------------------------------------------------

  if (loadingProfile || dbData.loading) {
    return (
      <DashboardLayout currentPath="/dashboard/book-appointment">
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600 font-bold">Cargando base de datos y perfiles...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout currentPath="/dashboard/book-appointment">
      <div className="w-full space-y-6">
        <div className="mb-8 text-left">
          <h2 className="text-3xl font-bold text-slate-900 mb-2 font-sans">Agendar Nueva Cita</h2>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            Sigue los pasos a continuación para reservar tu sesión clínica.
          </p>
        </div>

        {/* Stepper Superior */}
        {renderStepIndicator()}

        {/* 2-Column responsive layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main Content Area */}
          <div className="flex-1 min-w-0 w-full">
            {/* Mobile Summary */}
            <div className="lg:hidden">
              {renderAppointmentSummary(true)}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="min-h-[300px]">
                {currentStepId === 'paciente' && renderPaciente()}
                {currentStepId === 'modalidad' && renderModalidad()}
                {currentStepId === 'local' && renderLocal()}
                {currentStepId === 'servicio_tipo' && renderServicioTipo()}
                {currentStepId === 'especialista' && renderEspecialista()}
                {currentStepId === 'horario' && renderHorario()}
                {currentStepId === 'pago' && renderPago()}
              </div>

              {/* Navigation Buttons */}
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={stepIndex === 0 || savingAppointment || paymentModalRedirectOnClose}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Atrás
                </button>

                {stepIndex < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!puedesAvanzar()}
                    className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {steps[stepIndex]?.id === 'horario' ? 'Continuar al Pago' : 'Siguiente'}
                  </button>
                ) : paymentModalRedirectOnClose ? (
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/appointments')}
                    className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white rounded-xl text-sm font-bold transition-all cursor-pointer font-sans"
                  >
                    Finalizar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmarReserva}
                    disabled={savingAppointment}
                    className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-sans"
                  >
                    {savingAppointment ? 'Guardando Cita...' : 'Confirmar y Agendar'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Summary Sidebar */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0">
            {renderAppointmentSummary(false)}
          </div>
        </div>
      </div>

      {showCulqiModal && (
        <CulqiModal
          onClose={() => setShowCulqiModal(false)}
          emailDefault={getEmailDefault()}
          concept={servicioSeleccionado?.nombre_servicio}
          price={paqueteSeleccionado ? (paqueteSeleccionado.type === 'adquirido' ? 0 : paqueteSeleccionado.precio_total) : servicioSeleccionado?.precio_sesion}
          onPay={saveAppointment}
          navigate={navigate}
        />
      )}

      {/* Observations Modal */}
      {showCommentsModal && (
        <div 
          onClick={() => setShowCommentsModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6"
          >
            <header className="flex justify-between items-center pb-3 border-b mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003178]">rate_review</span>
                <h4 className="font-bold text-base text-gray-900 font-sans">
                  Comentarios para el Especialista
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCommentsModal(false)}
                className="text-gray-400 hover:text-gray-650 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="space-y-4 text-left">
              <p className="text-xs text-gray-500 leading-relaxed">
                ¿Deseas agregar alguna observación o motivo de consulta? Este comentario es opcional.
              </p>
              <textarea
                value={tempComentario}
                onChange={e => setTempComentario(e.target.value)}
                placeholder="Escribe tu comentario aquí..."
                rows="4"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none resize-none"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setComentario('');
                    setTempComentario('');
                    setShowCommentsModal(false);
                    const pagoIndex = steps.findIndex(s => s.id === 'pago');
                    if (pagoIndex !== -1) setStepIndex(pagoIndex);
                  }}
                  className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                >
                  Omitir / Continuar sin comentario
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComentario(tempComentario);
                    setShowCommentsModal(false);
                    const pagoIndex = steps.findIndex(s => s.id === 'pago');
                    if (pagoIndex !== -1) setStepIndex(pagoIndex);
                  }}
                  className="px-4 py-2 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer font-sans"
                >
                  Guardar y continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Details Modal */}
      {showPaymentModal && (
        <div 
          onClick={handleClosePaymentModal}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <header className="p-4 border-b border-gray-100 flex justify-between items-center bg-[#003178] text-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">credit_card</span>
                <div className="text-left">
                  <h3 className="font-bold text-sm font-sans">Detalles de Pago Clínico</h3>
                  <p className="text-[10px] text-blue-200">Realiza el pago antes de confirmar la cita</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClosePaymentModal}
                className="text-white hover:text-gray-200 p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </header>

            <div className="p-5 overflow-y-auto space-y-4 text-left flex-1 min-h-0">
              <div className="flex gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMetodoPagoOnlineDetalle('TRANSFERENCIA')}
                  className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${metodoPagoOnlineDetalle === 'TRANSFERENCIA'
                      ? 'bg-[#003178] border-[#003178] text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                    }`}
                >
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                  Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoPagoOnlineDetalle('YAPE')}
                  className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${metodoPagoOnlineDetalle === 'YAPE'
                      ? 'bg-[#003178] border-[#003178] text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                    }`}
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                  Yape
                </button>
              </div>

              {loadingMetodosPago ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : metodoPagoOnlineDetalle === 'TRANSFERENCIA' ? (
                (() => {
                  const item = metodosPagoClinica.find(m => m.tipo === 'TRANSFERENCIA') || {
                    banco: 'BCP',
                    moneda: 'Soles',
                    numero_cuenta: '19134627591062',
                    cci: '00219113462759106254',
                    titular: 'Dra. Milagros Ordinola Villegas',
                    mensaje_confirmacion: 'Realiza el depósito usando los datos seleccionados. Luego envía la captura de la transacción al número indicado para validar tu pago.',
                    telefono_confirmacion: '992722491'
                  };
                  return (
                    <div className="space-y-3">
                      <div className="bg-slate-50 border border-slate-205 rounded-xl p-3.5 space-y-2.5 text-xs text-gray-700">
                        <p><span className="font-bold text-slate-900 block mb-0.5 font-sans">Banco:</span> {item.banco}</p>
                        <p><span className="font-bold text-slate-900 block mb-0.5 font-sans">Moneda:</span> {item.moneda}</p>
                        
                        <div className="flex items-center justify-between gap-2 border-b border-slate-150 pb-1.5">
                          <div>
                            <span className="font-bold text-slate-900 block mb-0.5 font-mono">Número de Cuenta:</span>
                            <span className="font-mono">{item.numero_cuenta}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('cuenta', item.numero_cuenta)}
                            className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
                          >
                            {copiedField === 'cuenta' ? 'Copiado ✓' : 'Copiar'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-b border-slate-150 pb-1.5">
                          <div>
                            <span className="font-bold text-slate-900 block mb-0.5 font-mono">CCI:</span>
                            <span className="font-mono">{item.cci}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('cci', item.cci)}
                            className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
                          >
                            {copiedField === 'cci' ? 'Copiado ✓' : 'Copiar'}
                          </button>
                        </div>

                        <p><span className="font-bold text-slate-900 block mb-0.5 font-sans font-semibold">Titular:</span> {item.titular}</p>
                      </div>
                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                        <p className="font-semibold text-slate-800 mb-0.5 font-sans">Instrucciones:</p>
                        <p>{item.mensaje_confirmacion}</p>
                        <div className="font-semibold text-[#003178] mt-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 font-sans">
                            <span className="material-symbols-outlined text-[15px]">phone_iphone</span>
                            WhatsApp: {formatPhoneNumber(item.telefono_confirmacion)}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('whatsapp_trans', item.telefono_confirmacion)}
                            className="px-2 py-0.5 text-[9px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
                          >
                            {copiedField === 'whatsapp_trans' ? 'Copiado ✓' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const item = metodosPagoClinica.find(m => m.tipo === 'YAPE') || {
                    titular: 'Dra. Milagros Ordinola Villegas',
                    numero_yape: '992722491',
                    qr_url: null,
                    mensaje_confirmacion: 'Realiza el yapeo usando los datos seleccionados. Luego envía la captura de la transacción al número indicado para validar tu pago.',
                    telefono_confirmacion: '992722491'
                  };
                  const hasQr = item?.qr_url && String(item.qr_url).trim() !== '' && String(item.qr_url).trim().toLowerCase() !== 'null';
                  return (
                    <div className="space-y-3">
                      <div className="bg-slate-55 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-gray-700">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-150 pb-1.5">
                          <div>
                            <span className="font-bold text-slate-900 block mb-0.5 font-sans">Número Yape:</span>
                            <span className="font-mono">{formatPhoneNumber(item.numero_yape)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('yape', item.numero_yape)}
                            className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
                          >
                            {copiedField === 'yape' ? 'Copiado ✓' : 'Copiar'}
                          </button>
                        </div>
                        
                        <p><span className="font-bold text-slate-900 block mb-0.5 font-sans font-semibold">Titular:</span> {item.titular}</p>
                        
                        {hasQr && (
                          <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-lg mt-1">
                            <img src={item.qr_url} alt="QR Yape" className="w-32 h-32 object-contain" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                        <p className="font-semibold text-slate-800 mb-0.5 font-sans font-semibold">Instrucciones:</p>
                        <p>{item.mensaje_confirmacion}</p>
                        <div className="font-semibold text-[#003178] mt-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 font-sans">
                            <span className="material-symbols-outlined text-[15px]">phone_iphone</span>
                            WhatsApp: {formatPhoneNumber(item.telefono_confirmacion)}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('whatsapp_yape', item.telefono_confirmacion)}
                            className="px-2 py-0.5 text-[9px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
                          >
                            {copiedField === 'whatsapp_yape' ? 'Copiado ✓' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            <footer className="p-4 border-t border-gray-100 flex justify-end shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  if (paymentModalRedirectOnClose) {
                    navigate('/dashboard/appointments');
                  }
                }}
                className="px-4 py-2 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm font-sans"
              >
                {paymentModalRedirectOnClose ? 'Finalizar' : 'Entendido'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

// Extracted CulqiModal Component to resolve nested component render warnings
const CulqiModal = ({ onClose, emailDefault, concept, price, onPay, navigate }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [email, setEmail] = useState(emailDefault || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleCardNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCardNumber(val);
  };

  const handleExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 2) {
      val = val.slice(0, 2) + '/' + val.slice(2);
    }
    setCardExpiry(val);
  };

  const handleCvvChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 3);
    setCardCvv(val);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (cardNumber.length < 16) {
      setErrorMsg('El número de tarjeta debe tener 16 dígitos.');
      return;
    }
    if (cardExpiry.length < 5) {
      setErrorMsg('Ingresa una fecha de expiración válida (MM/AA).');
      return;
    }
    if (cardCvv.length < 3) {
      setErrorMsg('El CVV debe tener 3 dígitos.');
      return;
    }
    if (!cardName.trim()) {
      setErrorMsg('Ingresa el nombre del titular.');
      return;
    }

    setProcessing(true);

    setTimeout(async () => {
      try {
        const res = await onPay('Pagado', 'Online (Culqi)');
        if (res.success) {
          alert('¡Pago procesado exitosamente por Culqi!');
          onClose();
          navigate('/dashboard/appointments');
        } else {
          setErrorMsg(res.error || 'Error al guardar la cita.');
          setProcessing(false);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Error de red al procesar el pago.');
        setProcessing(false);
      }
    }, 2000);
  };

  return (
    <div 
      onClick={() => { if (!processing) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
      >
        <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#003178] text-white">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">credit_card</span>
            <div className="text-left">
              <h3 className="font-bold text-lg font-sans">Checkout Culqi</h3>
              <p className="text-xs text-blue-200">Pago 100% seguro y encriptado</p>
            </div>
          </div>
          {!processing && (
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer animate-in zoom-in duration-75"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </header>

        <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center mb-2">
            <div className="text-left font-sans">
              <p className="text-xs text-gray-505 uppercase tracking-wide font-bold">Concepto</p>
              <p className="text-sm font-bold text-slate-800">{concept}</p>
            </div>
            <p className="text-xl font-black text-[#003178]">
              S/ {price}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-55 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 text-left">
              <span className="material-symbols-outlined text-[16px] text-red-500">error</span>
              {errorMsg}
            </div>
          )}

          <div className="space-y-3 text-left">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Número de Tarjeta</label>
              <div className="relative">
                <input
                  required
                  disabled={processing}
                  type="text"
                  inputMode="numeric"
                  placeholder="4000 1234 5678 9010"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178] pl-10 font-sans"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">credit_card</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiración (MM/AA)</label>
                <input
                  required
                  disabled={processing}
                  type="text"
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChange={handleExpiryChange}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178] text-center font-sans"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CVV / CVN</label>
                <input
                  required
                  disabled={processing}
                  type="password"
                  inputMode="numeric"
                  placeholder="123"
                  value={cardCvv}
                  onChange={handleCvvChange}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178] text-center font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Titular de la Tarjeta</label>
              <input
                required
                disabled={processing}
                type="text"
                placeholder="Juan Pérez"
                value={cardName}
                onChange={e => setCardName(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178] font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-505 uppercase mb-1">Correo Electrónico</label>
              <input
                required
                disabled={processing}
                type="email"
                placeholder="juan.perez@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178] font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full bg-[#003178] hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 cursor-pointer font-sans"
          >
            {processing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Procesando Pago...
              </>
            ) : (
              <>
                Pagar S/ {price}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BookAppointment;