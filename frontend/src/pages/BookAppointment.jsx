import { useState, useEffect, Fragment, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import {
  obtenerServicios,
  obtenerPaquetes,
  obtenerPsicologasPorServicio,
  crearCita,
  obtenerLocalesActivos,
  obtenerHabitacionesPorLocal,
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

  // 5. Filtrar slots que se solapen con bloqueos o citas usando la condición slotStart < blockEnd && slotEnd > blockStart
  const slotsLibres = slotsUnicos.filter(slot => {
    const slotStart = parseTimeToMinutes(slot.inicio);
    const slotEnd = slotStart + duracionServicioMinutos; // slotEnd = inicio + duracion

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
      const blockEnd = parseTimeToMinutes(c.hora_fin) + bufferMinutos; // blockEnd = cita.hora_fin + BUFFER_MINUTOS
      return slotStart < blockEnd && slotEnd > blockStart;
    });

    if (solapaConCita) return false;

    return true;
  });

  // Mapear al formato esperado
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

  const availabilityCache = useRef({});
  const slotsCache = useRef({});
  const proximaFechaCache = useRef({});

  const [step, setStep] = useState(1);
  const [paraQuien, setParaQuien] = useState('yo'); // 'yo' o 'familiar'
  const [familiarId, setFamiliarId] = useState('');

  const [servicios, setServicios] = useState([]);
  const [loadingServicios, setLoadingServicios] = useState(true);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);

  const [paquetes, setPaquetes] = useState([]);
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState(null);

  const [paquetesAdquiridos, setPaquetesAdquiridos] = useState([]);

  const [psicologas, setPsicologas] = useState([]);
  const [loadingPsicologas, setLoadingPsicologas] = useState(false);
  const [fechasProximas, setFechasProximas] = useState({}); // map of id -> earliestDateStr
  const [psicologaSeleccionada, setPsicologaSeleccionada] = useState(null);

  const [fechasHabilitadas, setFechasHabilitadas] = useState(new Set());
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null); // Date object or null
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }); // Date object representing currently viewed month (safely starts at 1st day to avoid rollovers)

  const [slotsDisponibles, setSlotsDisponibles] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  const [modalidad, setModalidad] = useState('Presencial');
  const [comentario, setComentario] = useState('');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [tempComentario, setTempComentario] = useState('');
  const [metodoPago, setMetodoPago] = useState('clinica'); // 'clinica' o 'tarjeta'
  const [metodosPagoClinica, setMetodosPagoClinica] = useState([]);
  const [loadingMetodosPago, setLoadingMetodosPago] = useState(false);
  const [metodoPagoOnlineDetalle, setMetodoPagoOnlineDetalle] = useState('TRANSFERENCIA');

  // Cargar métodos de pago de clínica
  useEffect(() => {
    const cargarMetodosPago = async () => {
      setLoadingMetodosPago(true);
      try {
        const res = await obtenerMetodosPagoClinica();
        if (res) {
          setMetodosPagoClinica(res);
        }
      } catch (err) {
        console.error('Error al cargar métodos de pago de clínica:', err);
      } finally {
        setLoadingMetodosPago(false);
      }
    };
    cargarMetodosPago();
  }, []);

  const [showCulqiModal, setShowCulqiModal] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalRedirectOnClose, setPaymentModalRedirectOnClose] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

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

  const [locales, setLocales] = useState([]);
  const [loadingLocales, setLoadingLocales] = useState(false);
  const [loadingFechas, setLoadingFechas] = useState(false);
  const [errorLocales, setErrorLocales] = useState(false);
  const [localSeleccionado, setLocalSeleccionado] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [errorRooms, setErrorRooms] = useState(false);

  // Cargar locales activos
  useEffect(() => {
    const cargarLocales = async () => {
      setLoadingLocales(true);
      setErrorLocales(false);
      try {
        const res = await obtenerLocalesActivos();
        if (res === null) {
          setErrorLocales(true);
          setLocales([]);
        } else {
          setLocales(res);
          if (res.length > 0) {
            setLocalSeleccionado(res[0]);
          }
        }
      } catch (err) {
        console.error('Error al cargar locales:', err);
        setErrorLocales(true);
      } finally {
        setLoadingLocales(false);
      }
    };
    cargarLocales();
  }, []);

  const activeLocal = useMemo(() => {
    if (servicioSeleccionado?.local_id) {
      return locales.find(l => l.id === servicioSeleccionado.local_id) || null;
    }
    return localSeleccionado;
  }, [servicioSeleccionado, locales, localSeleccionado]);

  // Cargar habitaciones del local seleccionado
  useEffect(() => {
    const cargarRooms = async () => {
      if (!activeLocal) {
        setRooms([]);
        return;
      }
      setLoadingRooms(true);
      setErrorRooms(false);
      try {
        const res = await obtenerHabitacionesPorLocal(activeLocal.id);
        if (res === null) {
          setErrorRooms(true);
          setRooms([]);
        } else {
          setRooms(res);
        }
      } catch (err) {
        console.error('Error al cargar habitaciones:', err);
        setErrorRooms(true);
        setRooms([]);
      } finally {
        setLoadingRooms(false);
      }
    };
    cargarRooms();
  }, [activeLocal]);



  // 1. Cargar servicios
  useEffect(() => {
    const cargarServicios = async () => {
      setLoadingServicios(true);
      const res = await obtenerServicios();
      if (res.success) {
        setServicios(res.data);
      }
      setLoadingServicios(false);
    };
    cargarServicios();
  }, []);

  // 2. Cargar paquetes al cambiar servicio
  useEffect(() => {
    if (servicioSeleccionado) {
      obtenerPaquetes(servicioSeleccionado.id).then(res => {
        if (res.success) setPaquetes(res.data);
        else setPaquetes([]);
      });
    }
  }, [servicioSeleccionado]);

  // 3. Cargar paquetes adquiridos disponibles (Opción B)
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

  // Helper safe date format (timezone safe)
  const formatDateStr = (year, month, day) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Helper photo mapping
  const getPsicoFoto = (id) => {
    if (id === 'a1f981b3-30fd-4ba8-80da-c32f4f5b1b51') return '/dr_valeria.png';
    if (id === 'a1f981b3-30fd-4ba8-80da-c32f4f5b1b52') return '/mg_beatriz.png';
    if (id === 'a1f981b3-30fd-4ba8-80da-c32f4f5b1b53') return '/lic_camila.png';
    return null;
  };

  // Calcular la fecha disponible más próxima para un especialista
  const calcularFechaMasProxima = async (psicologoId, currentModalidad, localId) => {
    const key = `${psicologoId}-${servicioSeleccionado?.id}-${currentModalidad}-${localId || 'none'}`;
    if (proximaFechaCache.current[key] !== undefined) {
      return proximaFechaCache.current[key];
    }

    const run = async () => {
      try {
        const hoy = new Date();
        const todayStr = hoy.toISOString().split('T')[0];
        const duracion = servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 60;

        // Obtener horarios de la psicóloga
        const { data: horarios, error: errH } = await supabase
          .from('horarios_empleados')
          .select('*')
          .eq('empleado_id', psicologoId)
          .eq('modalidad', currentModalidad)
          .gte('fecha', todayStr)
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true });

        if (errH || !horarios || horarios.length === 0) return null;

        // Fetch active rooms for local if presencial
        let localRooms = [];
        if (currentModalidad === 'Presencial' && localId) {
          const { data: roomsData } = await supabase
            .from('habitaciones')
            .select('*')
            .eq('local_id', localId)
            .eq('activo', true);
          localRooms = roomsData || [];
        }

        // Obtener citas activas
        const { data: citas, error: errC } = await supabase
          .from('citas')
          .select('fecha_cita, hora_inicio, hora_fin, estado_cita, habitacion_id')
          .eq('psicologo_id', psicologoId)
          .gte('fecha_cita', todayStr);

        if (errC) return null;

        // Buscar el primer día con slots libres
        const uniqueFechas = [...new Set(horarios.map(h => h.fecha))].sort();

        for (const fecha of uniqueFechas) {
          const horariosDelDia = horarios.filter(h => h.fecha === fecha);
          const citasDelDia = (citas || []).filter(c => c.fecha_cita === fecha);
          let slotsLibres = obtenerSlotsLibresDia(horariosDelDia, citasDelDia, duracion, BUFFER_MINUTOS);

          // Filter slots by room availability if presencial
          if (currentModalidad === 'Presencial' && localId && localRooms.length > 0) {
            const { data: allCitasDelDia } = await supabase
              .from('citas')
              .select('hora_inicio, hora_fin, habitacion_id')
              .eq('fecha_cita', fecha)
              .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

            slotsLibres = slotsLibres.filter(slot => {
              const slotStart = parseTimeToMinutes(slot.inicio);
              const slotEnd = slotStart + duracion;

              return localRooms.some(room => {
                const isOccupied = (allCitasDelDia || []).some(c => {
                  if (c.habitacion_id !== room.id) return false;
                  const cStart = parseTimeToMinutes(c.hora_inicio);
                  const cEnd = parseTimeToMinutes(c.hora_fin);
                  return slotStart < cEnd && slotEnd > cStart;
                });
                return !isOccupied;
              });
            });
          }

          if (slotsLibres.length > 0) {
            return fecha;
          }
        }
        return null;
      } catch (e) {
        console.error(e);
        return null;
      }
    };

    const res = await run();
    proximaFechaCache.current[key] = res;
    return res;
  };

  // Cargar psicólogas del servicio y precalcular sus fechas más próximas
  const cargarPsicologas = async (servId, currentModalidad) => {
    setLoadingPsicologas(true);
    const res = await obtenerPsicologasPorServicio(servId);
    if (res.success) {
      setPsicologas(res.data);
      const proximas = {};
      for (const p of res.data) {
        const fecha = await calcularFechaMasProxima(p.id, currentModalidad, activeLocal?.id);
        proximas[p.id] = fecha;
      }
      setFechasProximas(proximas);
    }
    setLoadingPsicologas(false);
  };



  // Recargar psicólogas y su disponibilidad si cambia el local activo o la modalidad
  useEffect(() => {
    if (step === 3 && servicioSeleccionado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarPsicologas(servicioSeleccionado.id, modalidad);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocal, step]);

  const cargarFechasHabilitadas = async (psicologoId, currentModalidad, localId) => {
    const key = `${psicologoId}-${servicioSeleccionado?.id}-${currentModalidad}-${localId || 'none'}`;
    if (availabilityCache.current[key]) {
      setFechasHabilitadas(availabilityCache.current[key]);
      return;
    }

    setLoadingFechas(true);
    setFechasHabilitadas(new Set());
    try {
      const hoy = new Date();
      const todayStr = hoy.toISOString().split('T')[0];
      const duracion = servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 60;

      const { data: horarios } = await supabase
        .from('horarios_empleados')
        .select('*')
        .eq('empleado_id', psicologoId)
        .eq('modalidad', currentModalidad)
        .gte('fecha', todayStr);

      const { data: citas } = await supabase
        .from('citas')
        .select('fecha_cita, hora_inicio, hora_fin, estado_cita, habitacion_id')
        .eq('psicologo_id', psicologoId)
        .gte('fecha_cita', todayStr);

      // Fetch active rooms for local if presencial
      let localRooms = [];
      if (currentModalidad === 'Presencial' && localId) {
        const { data: roomsData } = await supabase
          .from('habitaciones')
          .select('*')
          .eq('local_id', localId)
          .eq('activo', true);
        localRooms = roomsData || [];
      }

      const habilitadas = new Set();
      if (horarios) {
        const uniqueFechas = [...new Set(horarios.map(h => h.fecha))];
        for (const fecha of uniqueFechas) {
          const horariosDelDia = horarios.filter(h => h.fecha === fecha);
          const citasDelDia = (citas || []).filter(c => c.fecha_cita === fecha);
          let slotsLibres = obtenerSlotsLibresDia(horariosDelDia, citasDelDia, duracion, BUFFER_MINUTOS);

          // Filter by room availability if presencial
          if (currentModalidad === 'Presencial' && localId && localRooms.length > 0) {
            const { data: allCitasDelDia } = await supabase
              .from('citas')
              .select('hora_inicio, hora_fin, habitacion_id')
              .eq('fecha_cita', fecha)
              .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

            slotsLibres = slotsLibres.filter(slot => {
              const slotStart = parseTimeToMinutes(slot.inicio);
              const slotEnd = slotStart + duracion;

              return localRooms.some(room => {
                const isOccupied = (allCitasDelDia || []).some(c => {
                  if (c.habitacion_id !== room.id) return false;
                  const cStart = parseTimeToMinutes(c.hora_inicio);
                  const cEnd = parseTimeToMinutes(c.hora_fin);
                  return slotStart < cEnd && slotEnd > cStart;
                });
                return !isOccupied;
              });
            });
          }

          if (slotsLibres.length > 0) {
            habilitadas.add(fecha);
          }
        }
      }
      availabilityCache.current[key] = habilitadas;
      setFechasHabilitadas(habilitadas);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFechas(false);
    }
  };

  // Cargar slots libres para un día específico
  const cargarSlotsDelDia = async (psicologoId, fechaStr, currentModalidad, localId) => {
    const key = `${psicologoId}-${servicioSeleccionado?.id}-${fechaStr}-${currentModalidad}-${localId || 'none'}`;
    if (slotsCache.current[key]) {
      setSlotsDisponibles(slotsCache.current[key]);
      return;
    }

    setLoadingSlots(true);
    try {
      const { data: horarios } = await supabase
        .from('horarios_empleados')
        .select('*')
        .eq('empleado_id', psicologoId)
        .eq('modalidad', currentModalidad)
        .eq('fecha', fechaStr)
        .order('hora_inicio', { ascending: true });

      const { data: citas } = await supabase
        .from('citas')
        .select('hora_inicio, hora_fin, estado_cita, habitacion_id')
        .eq('psicologo_id', psicologoId)
        .eq('fecha_cita', fechaStr);

      const duracion = servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 60;
      let libres = obtenerSlotsLibresDia(horarios, citas, duracion, BUFFER_MINUTOS);

      // Filter by room availability if presencial
      if (currentModalidad === 'Presencial' && localId) {
        const { data: roomsData } = await supabase
          .from('habitaciones')
          .select('*')
          .eq('local_id', localId)
          .eq('activo', true);
        const localRooms = roomsData || [];

        if (localRooms.length > 0) {
          const { data: allCitasDelDia } = await supabase
            .from('citas')
            .select('hora_inicio, hora_fin, habitacion_id')
            .eq('fecha_cita', fechaStr)
            .in('estado_cita', ['Pendiente', 'Confirmada', 'Reprogramada']);

          libres = libres.filter(slot => {
            const slotStart = parseTimeToMinutes(slot.inicio);
            const slotEnd = slotStart + duracion;

            return localRooms.some(room => {
              const isOccupied = (allCitasDelDia || []).some(c => {
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

      slotsCache.current[key] = libres;
      setSlotsDisponibles(libres);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Validar si un perfil clínico está incompleto (para sí mismo o familiares)
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

  // Lógica de avance en el wizard
  const puedesAvanzar = () => {
    if (step === 1) {
      if (paraQuien === 'yo') return !esClinicoIncompletoYo;
      return familiarId !== '' && !esClinicoIncompletoFamiliar;
    }
    if (step === 2) return servicioSeleccionado !== null;
    if (step === 3) {
      if (modalidad === 'Presencial') {
        if (!activeLocal) return false;
        if (errorLocales || locales.length === 0) return false;
        if (errorRooms || rooms.length === 0) return false;
      }
      return psicologaSeleccionada !== null;
    }
    if (step === 4) return fechaSeleccionada !== null && slotSeleccionado !== null;
    return true;
  };

  const nextStep = () => {
    if (puedesAvanzar()) {
      if (step === 2) {
        cargarPsicologas(servicioSeleccionado.id, modalidad);
      }
      if (step === 3) {
        cargarFechasHabilitadas(psicologaSeleccionada.id, modalidad, activeLocal?.id);
        setFechaSeleccionada(null);
        setSlotSeleccionado(null);
      }
      if (step === 4) {
        setTempComentario(comentario);
        setShowCommentsModal(true);
        return;
      }
      setStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  // Guardar cita en Supabase
  const saveAppointment = async (estadoPago, metodoPagoVal) => {
    setSavingAppointment(true);
    setBookingError('');
    try {
      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio.id_paciente : familiarId;
      const dateStr = formatDateStr(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate());

      // Map payment methods correctly
      let dbMetodoPago = metodoPagoVal;
      if (metodoPagoVal === 'Pago en clínica') {
        dbMetodoPago = 'Pago en Clínica';
      } else if (metodoPagoVal === 'Online (Culqi)' || metodoPagoVal === 'Pago Online') {
        dbMetodoPago = 'Pago Online';
      }

      // Real-time validation if scheduling with an existing package
      if (paqueteSeleccionado && paqueteSeleccionado.type === 'adquirido') {
        // Query current state of this acquired package from DB
        const { data: dbPack, error: dbPackErr } = await supabase
          .from('paquetes_adquiridos')
          .select('sesiones_disponibles')
          .eq('id', paqueteSeleccionado.id)
          .single();

        if (dbPackErr || !dbPack) {
          throw new Error('No se pudo encontrar el paquete adquirido especificado.');
        }

        // Count pending appointments in DB for this package
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

          // It's a new package from the catalog, so we insert it into paquetes_adquiridos
          const { data: newPack, error: packErr } = await supabase
            .from('paquetes_adquiridos')
            .insert([{
              paciente_id: pacienteId,
              servicio_id: servicioSeleccionado.id,
              paquete_catalogo_id: paqueteSeleccionado.id,
              nombre_paquete_snapshot: paqueteSeleccionado.nombre_paquete,
              sesiones_totales: sesionesTotales,
              sesiones_disponibles: sesionesTotales, // Option B: keep all sessions available initially
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

      // Assign room automatically at confirmation time if presencial
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

  // Funciones de control de fecha
  // Funciones de control de fecha (optimizadas con useMemo para prevenir lentitud y renders extras)
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

  const cambiarMes = (incremento) => {
    const nueva = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1); // safe from end-of-month rollovers
    nueva.setMonth(nueva.getMonth() + incremento);
    setCalendarMonth(nueva);
  };

  // Render del Calendario
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
                  cargarSlotsDelDia(psicologaSeleccionada.id, dateStr, modalidad, activeLocal?.id);
                  setSlotSeleccionado(null);
                }}
                className={`py-2.5 rounded-xl font-bold ${isSelected
                  ? 'bg-[#003178] text-white shadow-md'
                  : isEnabled
                    ? 'bg-blue-50/60 hover:bg-blue-100/70 text-gray-900 border border-blue-100 cursor-pointer'
                    : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed opacity-50'
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

  // Elementos visuales de cada paso
  const steps = [
    { number: 1, label: 'Paciente' },
    { number: 2, label: 'Servicio' },
    { number: 3, label: 'Especialista' },
    { number: 4, label: 'Fecha y Horario' },
    { number: 5, label: 'Pago' }
  ];

  const renderStepIndicator = () => {
    return (
      <div className="mb-10">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          {steps.map((s, idx) => {
            const isCompleted = step > s.number;
            const isActive = step === s.number;
            return (
              <Fragment key={s.number}>
                <div className="flex flex-col items-center relative flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${isCompleted
                    ? 'bg-[#003178] border-[#003178] text-white'
                    : isActive
                      ? 'bg-blue-50 border-[#003178] text-[#003178] font-black'
                      : 'bg-white border-gray-200 text-gray-400'
                    }`}>
                    {isCompleted ? <span className="material-symbols-outlined text-[16px]">check</span> : s.number}
                  </div>
                  <span className={`text-[10px] md:text-xs font-semibold mt-2 text-center absolute -bottom-6 w-24 ${isActive ? 'text-[#003178] font-bold' : 'text-gray-400'
                    }`}>
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`h-[2px] flex-1 transition-all ${step > s.number ? 'bg-[#003178]' : 'bg-gray-200'
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

  const renderStep1 = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${paraQuien === 'yo'
              ? 'border-[#003178] bg-blue-50/40 shadow-sm'
              : 'border-gray-200 hover:bg-gray-50'
              }`}
            onClick={() => {
              setParaQuien('yo');
              setFamiliarId('');
            }}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${paraQuien === 'yo' ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                <span className="material-symbols-outlined">account_circle</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Cita para mí</p>
                <p className="text-xs text-gray-500 mt-0.5">Reservar usando mi ficha clínica</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${paraQuien === 'familiar'
              ? 'border-[#003178] bg-blue-50/40 shadow-sm'
              : 'border-gray-200 hover:bg-gray-50'
              }`}
            onClick={() => setParaQuien('familiar')}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${paraQuien === 'familiar' ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                <span className="material-symbols-outlined">groups</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Cita para otro miembro</p>
                <p className="text-xs text-gray-500 mt-0.5">Hijo, pareja o familiar dependiente</p>
              </div>
            </div>
          </button>
        </div>

        {paraQuien === 'yo' && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-3">Datos del Titular</h4>
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
                    Para agendar una cita para ti, primero debes completar los campos obligatorios de tu ficha clínica (dirección, género, etc.) en "Mi Perfil".
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/profile')}
                    className="mt-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    Completar Mi Perfil
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {paraQuien === 'familiar' && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Seleccionar Miembro Dependiente</h4>

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
                    onChange={e => setFamiliarId(e.target.value)}
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

  const renderStep2 = () => {
    if (loadingServicios) {
      return (
        <div className="flex justify-center items-center py-10">
          <div className="w-8 h-8 border-3 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2">Servicios Disponibles</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servicios.map(s => {
            const isSelected = servicioSeleccionado?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`p-5 rounded-2xl border text-left cursor-pointer ${isSelected
                  ? 'border-[#003178] bg-blue-50/40 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50'
                  }`}
                onClick={() => {
                  setServicioSeleccionado(s);
                  setPaqueteSeleccionado(null);
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-bold text-gray-900 text-base">{s.nombre_servicio}</h5>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.descripcion || 'Sin descripción'}</p>
                    <p className="text-xs text-[#003178] font-bold mt-2">Duración: {s.duracion_minutos || 50} min</p>
                  </div>
                  <span className="text-lg font-black text-[#003178] shrink-0 ml-4">S/ {s.precio_sesion}</span>
                </div>
              </button>
            );
          })}
        </div>

        {servicioSeleccionado && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mt-6 space-y-4">
            <h5 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Opciones de Sesión</h5>

            {/* Seccion de Paquetes Adquiridos */}
            {paquetesAdquiridos.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
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
                        className={`p-4 rounded-xl border text-left bg-white cursor-pointer ${isSelected
                          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                          : 'border-emerald-200 hover:bg-emerald-50/30'
                          }`}
                        onClick={() => setPaqueteSeleccionado({ ...p, type: 'adquirido' })}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm text-emerald-900">{p.nombre_paquete_snapshot || 'Paquete Adquirido'}</p>
                            <p className="text-xs text-emerald-700 mt-0.5">
                              {p.sesiones_netas} {p.sesiones_netas === 1 ? 'sesión neta disponible' : 'sesiones netas disponibles'}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              (Disponibles: {p.sesiones_disponibles} | Pendientes: {p.citas_pendientes})
                            </p>
                          </div>
                          <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">S/ 0</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seccion de Nuevas Sesiones / Compras */}
            <div className="space-y-3 pt-2">
              {paquetesAdquiridos.length > 0 && (
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nuevas Sesiones o Compras de Paquetes
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  className={`p-4 rounded-xl border text-left bg-white cursor-pointer ${!paqueteSeleccionado
                    ? 'border-[#003178] ring-1 ring-[#003178]'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  onClick={() => setPaqueteSeleccionado(null)}
                >
                  <p className="font-bold text-sm text-gray-900">Sesión Individual</p>
                  <p className="text-xs text-gray-500 mt-0.5">Paga solo por la sesión programada</p>
                  <p className="text-sm font-black text-[#003178] mt-2">S/ {servicioSeleccionado.precio_sesion}</p>
                </button>

                {paquetes.map(p => {
                  const isSelected = paqueteSeleccionado?.id === p.id && paqueteSeleccionado?.type !== 'adquirido';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`p-4 rounded-xl border text-left bg-white cursor-pointer ${isSelected
                        ? 'border-[#003178] ring-1 ring-[#003178]'
                        : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      onClick={() => setPaqueteSeleccionado(p)}
                    >
                      <p className="font-bold text-sm text-gray-900">{p.nombre_paquete}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.cantidad_sesiones ?? p.cant_sesiones} sesiones incluidas</p>
                      <p className="text-sm font-black text-[#003178] mt-2">S/ {p.precio_total}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => {
    const psicologasDisponibles = psicologas.filter(p => fechasProximas[p.id] !== null);

    return (
      <div className="space-y-6">
        {modalidad === 'Presencial' && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm max-w-md">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Seleccionar Local / Sede *</label>
            {loadingLocales ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                <div className="w-4 h-4 border-2 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
                Cargando locales...
              </div>
            ) : errorLocales ? (
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
                No se pudieron cargar los locales. Revisa permisos de lectura.
              </div>
            ) : locales.length === 0 ? (
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-[18px]">warning</span>
                No hay locales disponibles para agendar citas presenciales.
              </div>
            ) : (
              <>
                <select
                  value={activeLocal?.id || ''}
                  onChange={(e) => {
                    const selected = locales.find(l => l.id === e.target.value);
                    setLocalSeleccionado(selected || null);
                    setFechaSeleccionada(null);
                    setSlotSeleccionado(null);
                    setSlotsDisponibles([]);
                    setFechasHabilitadas(new Set());
                  }}
                  disabled={!!servicioSeleccionado?.local_id}
                  className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm focus:border-[#003178] outline-none text-gray-700 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Selecciona una sede...</option>
                  {locales.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} - {l.direccion}
                    </option>
                  ))}
                </select>
                {servicioSeleccionado?.local_id && (
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    * Este servicio está asignado de forma fija a esta sede.
                  </p>
                )}
              </>
            )}

            {modalidad === 'Presencial' && activeLocal && !loadingRooms && (
              loadingLocales ? null : errorRooms ? (
                <div className="mt-3 p-3 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
                  No se pudieron cargar los consultorios. Revisa permisos de lectura.
                </div>
              ) : rooms.length === 0 ? (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">warning</span>
                  No hay consultorios registrados para este local.
                </div>
              ) : null
            )}
          </div>
        )}

        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2">Especialistas para este Servicio</h4>

        {loadingPsicologas || loadingRooms ? (
          <div className="flex justify-center items-center py-10">
            <div className="w-8 h-8 border-3 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (modalidad === 'Presencial' && (errorRooms || rooms.length === 0)) ? (
          <p className="text-sm text-gray-550 bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
            {errorRooms ? 'No se pudieron cargar los consultorios. Revisa permisos de lectura.' : 'Debes seleccionar un local con consultorios disponibles para ver especialistas.'}
          </p>
        ) : psicologasDisponibles.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-4 text-center">No hay especialistas disponibles para este servicio en los próximos días.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {psicologasDisponibles.map(p => {
              const isSelected = psicologaSeleccionada?.id === p.id;
              const foto = getPsicoFoto(p.id) || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200';
              const fechaProx = fechasProximas[p.id];

              return (
                <button
                  key={p.id}
                  type="button"
                  className={`flex flex-col bg-white rounded-2xl border overflow-hidden text-left cursor-pointer ${isSelected
                    ? 'border-[#003178] ring-2 ring-blue-50/50 shadow-md'
                    : 'border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                    }`}
                  onClick={() => setPsicologaSeleccionada(p)}
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
                      <h5 className="font-bold text-gray-900 text-sm leading-tight">{p.nombres_apellidos}</h5>
                      <p className="text-xs text-gray-400 mt-1">{p.correo || 'Especialista CEPSITCED'}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#003178] text-[16px]">calendar_today</span>
                      <span className="text-[11px] font-bold text-[#003178]">
                        Disponible desde: {new Date(fechaProx + 'T00:00:00').toLocaleDateString('es-PE')}
                      </span>
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

  const renderStep4 = () => {
    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2">Seleccionar Fecha y Horario</h4>

        {loadingFechas ? (
          <div className="p-4 bg-blue-50 border border-blue-100 text-[#003178] text-sm rounded-xl flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
            Buscando horarios disponibles...
          </div>
        ) : fechasHabilitadas.size === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-250 text-amber-800 text-sm rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            No hay disponibilidad para esta modalidad con la especialista seleccionada.
          </div>
        ) : null}

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* LADO IZQUIERDO: CALENDARIO */}
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
                <span className="font-bold text-sm text-slate-800 uppercase tracking-wider">
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
                <p className="font-bold text-sm text-[#003178] mt-1 text-capitalize">
                  {fechaSeleccionada.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* LADO DERECHO: MODALIDAD Y HORARIOS */}
          <div className="h-[430px] max-h-[430px] flex flex-col gap-4 min-h-0 w-full">
            {/* Modalidad */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm shrink-0">
              <h5 className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-wider">1. Modalidad</h5>
              <div className="flex gap-4">
                <button
                  type="button"
                  className={`flex-1 py-3.5 px-4 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${modalidad === 'Presencial'
                      ? 'bg-[#003178] border-[#003178] text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-750 hover:bg-gray-50'
                    }`}
                  onClick={async () => {
                    if (modalidad !== 'Presencial') {
                      setModalidad('Presencial');
                      setFechaSeleccionada(null);
                      setSlotSeleccionado(null);
                      setSlotsDisponibles([]);
                      await cargarFechasHabilitadas(psicologaSeleccionada.id, 'Presencial', activeLocal?.id);
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                  Presencial
                </button>
                <button
                  type="button"
                  className={`flex-1 py-3.5 px-4 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${modalidad === 'Virtual'
                      ? 'bg-[#003178] border-[#003178] text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  onClick={async () => {
                    if (modalidad !== 'Virtual') {
                      setModalidad('Virtual');
                      setFechaSeleccionada(null);
                      setSlotSeleccionado(null);
                      setSlotsDisponibles([]);
                      setMetodoPago('tarjeta');
                      await cargarFechasHabilitadas(psicologaSeleccionada.id, 'Virtual', activeLocal?.id);
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">videocam</span>
                  Virtual
                </button>
              </div>
            </div>

            {/* Horarios */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col min-h-0">
              <h5 className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-wider shrink-0">2. Horarios Disponibles</h5>
              {!fechaSeleccionada ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-gray-550 bg-white border border-gray-150 rounded-xl p-4 text-center w-full">
                    Selecciona una fecha en el calendario para ver los horarios.
                  </p>
                </div>
              ) : loadingSlots ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
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
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs cursor-pointer h-10 flex items-center justify-center ${isSelected
                            ? 'bg-[#003178] border-[#003178] text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
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

  const renderStep5 = () => {
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
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2">Confirmación y Pago</h4>

        {bookingError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500">error</span>
            {bookingError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Resumen */}
          <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h5 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Resumen de la Cita</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Paciente</p>
                <p className="font-bold text-slate-800 mt-0.5">{pacienteNombre}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Especialista</p>
                <p className="font-bold text-slate-800 mt-0.5">{psicologaSeleccionada?.nombres_apellidos}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Servicio</p>
                <p className="font-bold text-[#003178] mt-0.5">{servicioSeleccionado?.nombre_servicio}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Modalidad</p>
                <p className="font-bold text-slate-800 mt-0.5 capitalize">{modalidad}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Ubicación / Local</p>
                <p className="font-bold text-slate-800 mt-0.5">
                  {modalidad === 'Virtual' ? 'Atención virtual' : (activeLocal?.nombre || 'Sede Central')}
                </p>
              </div>
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

          {/* Método de pago */}
          {paqueteSeleccionado?.type === 'adquirido' ? (
            <div className="md:col-span-5 space-y-4">
              <h5 className="font-bold text-sm text-slate-700 mb-3">Método de Pago</h5>
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex gap-3 shadow-sm">
                <span className="material-symbols-outlined text-emerald-600 text-[24px] shrink-0">check_circle</span>
                <div>
                  <p className="font-bold text-sm">Sesión Pre-pagada</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Se utilizará una sesión de tu paquete "{paqueteSeleccionado.nombre_paquete_snapshot || paqueteSeleccionado.nombre_paquete}".
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium mt-1">
                    Método de pago del paquete: {paqueteSeleccionado.metodo_pago}
                  </p>
                </div>
              </div>
              <div className="bg-[#003178]/5 border border-[#003178]/10 rounded-2xl p-4 flex justify-between items-center mt-6">
                <span className="font-bold text-sm text-slate-700">Total a pagar:</span>
                <span className="text-2xl font-black text-[#003178]">S/ 0</span>
              </div>
            </div>
          ) : (
            <div className="md:col-span-5 space-y-4">
              <h5 className="font-bold text-sm text-slate-700 mb-3">Selecciona el Método de Pago</h5>

              <div className="flex flex-col gap-3">
                <label className={`flex items-center p-4 border rounded-2xl cursor-pointer ${metodoPago === 'clinica'
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
                    <p className="font-bold text-sm text-gray-900">Pago en Clínica</p>
                    <p className="text-xs text-gray-500 mt-0.5">Paga en la recepción física el día de tu cita</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[24px]">storefront</span>
                </label>

                <label className={`flex items-center p-4 border rounded-2xl cursor-pointer ${metodoPago === 'tarjeta'
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
                    <p className="font-bold text-sm text-gray-900">Pago Online</p>
                    <p className="text-xs text-gray-500 mt-0.5">Transferencia bancaria o Yape</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[24px]">credit_card</span>
                </label>
              </div>

              {metodoPago === 'tarjeta' && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full py-3 px-4 border border-[#003178] text-[#003178] hover:bg-blue-50/50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Ver datos de pago
                  </button>
                </div>
              )}

              {modalidad === 'Virtual' && (
                <p className="text-[11px] text-amber-600 font-medium">
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

  if (loadingProfile) {
    return (
      <DashboardLayout currentPath="/dashboard/book-appointment">
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Cargando datos de miembro...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout currentPath="/dashboard/book-appointment">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Agendar Nueva Cita</h2>
          <p className="text-gray-500 text-lg mt-2">Sigue los pasos a continuación para reservar tu sesión clínica.</p>
        </div>

        {/* Timeline stepper */}
        {renderStepIndicator()}

        <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
          {/* Contenido del paso actual */}
          <div className="min-h-[300px]">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </div>

          {/* Botones de navegación del stepper */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1 || savingAppointment || paymentModalRedirectOnClose}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Atrás
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!puedesAvanzar()}
                className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Siguiente
              </button>
            ) : paymentModalRedirectOnClose ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard/appointments')}
                className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                Finalizar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmarReserva}
                disabled={savingAppointment}
                className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {savingAppointment ? 'Guardando Cita...' : 'Confirmar y Agendar'}
              </button>
            )}
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
                <h4 className="font-bold text-base text-gray-900">
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
            <div className="space-y-4">
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
                    setStep(5);
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
                    setStep(5);
                  }}
                  className="px-4 py-2 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Guardar y continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <div>
                  <h3 className="font-bold text-sm">Detalles de Pago Clínico</h3>
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
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
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
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
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
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-gray-700">
                        <p><span className="font-bold text-slate-900 block mb-0.5">Banco:</span> {item.banco}</p>
                        <p><span className="font-bold text-slate-900 block mb-0.5">Moneda:</span> {item.moneda}</p>
                        
                        <div className="flex items-center justify-between gap-2 border-b border-slate-150 pb-1.5">
                          <div>
                            <span className="font-bold text-slate-900 block mb-0.5 font-mono">Número de Cuenta:</span>
                            <span className="font-mono">{item.numero_cuenta}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('cuenta', item.numero_cuenta)}
                            className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer"
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
                            className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            {copiedField === 'cci' ? 'Copiado ✓' : 'Copiar'}
                          </button>
                        </div>

                        <p><span className="font-bold text-slate-900 block mb-0.5">Titular:</span> {item.titular}</p>
                      </div>
                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                        <p className="font-semibold text-slate-800 mb-0.5">Instrucciones:</p>
                        <p>{item.mensaje_confirmacion}</p>
                        <div className="font-semibold text-[#003178] mt-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">phone_iphone</span>
                            WhatsApp: {formatPhoneNumber(item.telefono_confirmacion)}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('whatsapp_trans', item.telefono_confirmacion)}
                            className="px-2 py-0.5 text-[9px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer"
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
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-gray-700">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-150 pb-1.5">
                          <div>
                            <span className="font-bold text-slate-900 block mb-0.5">Número Yape:</span>
                            <span>{formatPhoneNumber(item.numero_yape)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('yape', item.numero_yape)}
                            className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            {copiedField === 'yape' ? 'Copiado ✓' : 'Copiar'}
                          </button>
                        </div>
                        
                        <p><span className="font-bold text-slate-900 block mb-0.5">Titular:</span> {item.titular}</p>
                        
                        {hasQr && (
                          <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-lg mt-1">
                            <img src={item.qr_url} alt="QR Yape" className="w-32 h-32 object-contain" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                        <p className="font-semibold text-slate-800 mb-0.5">Instrucciones:</p>
                        <p>{item.mensaje_confirmacion}</p>
                        <div className="font-semibold text-[#003178] mt-2 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">phone_iphone</span>
                            WhatsApp: {formatPhoneNumber(item.telefono_confirmacion)}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('whatsapp_yape', item.telefono_confirmacion)}
                            className="px-2 py-0.5 text-[9px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer"
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
                className="px-4 py-2 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in-up"
      >
        <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#003178] text-white">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">credit_card</span>
            <div>
              <h3 className="font-bold text-lg">Checkout Culqi</h3>
              <p className="text-xs text-blue-200">Pago 100% seguro y encriptado</p>
            </div>
          </div>
          {!processing && (
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </header>

        <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center mb-2">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Concepto</p>
              <p className="text-sm font-bold text-slate-800">{concept}</p>
            </div>
            <p className="text-xl font-black text-[#003178]">
              S/ {price}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-red-500">error</span>
              {errorMsg}
            </div>
          )}

          <div className="space-y-3">
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
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178] pl-10"
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
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178] text-center"
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
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178] text-center"
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
                className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electrónico</label>
              <input
                required
                disabled={processing}
                type="email"
                placeholder="juan.perez@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003178]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full bg-[#003178] hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 cursor-pointer"
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