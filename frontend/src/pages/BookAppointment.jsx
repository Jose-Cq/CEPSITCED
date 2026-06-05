import { useState, useEffect, Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import {
  obtenerServicios,
  obtenerPaquetes,
  obtenerPsicologasPorServicio,
  crearCita
} from '../utils/supabaseHelpers';
import { supabase } from '../supabaseClient';

const BUFFER_MINUTOS = 30;

/**
 * Genera bloques de 30 minutos dentro del rango laboral de la jornada.
 * Valida que cada slot tenga suficiente espacio para completarse dentro de la jornada laboral.
 */
const generarSlots30Min = (horaInicioShift, horaFinShift, duracionServicioMinutos) => {
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

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
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

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

const BookAppointment = () => {
  const navigate = useNavigate();
  const { loading: loadingProfile, perfilUsuario, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();

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

  const [showCulqiModal, setShowCulqiModal] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [bookingError, setBookingError] = useState('');

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
  const calcularFechaMasProxima = async (psicologoId, currentModalidad) => {
    try {
      const hoy = new Date();
      const todayStr = hoy.toISOString().split('T')[0];
      const duracion = servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 30;

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

      // Obtener citas activas
      const { data: citas, error: errC } = await supabase
        .from('citas')
        .select('fecha_cita, hora_inicio, hora_fin, estado_cita')
        .eq('psicologo_id', psicologoId)
        .gte('fecha_cita', todayStr);

      if (errC) return null;

      // Buscar el primer día con slots libres
      const uniqueFechas = [...new Set(horarios.map(h => h.fecha))].sort();

      for (const fecha of uniqueFechas) {
        const horariosDelDia = horarios.filter(h => h.fecha === fecha);
        const citasDelDia = (citas || []).filter(c => c.fecha_cita === fecha);
        const slotsLibres = obtenerSlotsLibresDia(horariosDelDia, citasDelDia, duracion, BUFFER_MINUTOS);
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

  // Cargar psicólogas del servicio y precalcular sus fechas más próximas
  const cargarPsicologas = async (servId, currentModalidad) => {
    setLoadingPsicologas(true);
    const res = await obtenerPsicologasPorServicio(servId);
    if (res.success) {
      setPsicologas(res.data);
      const proximas = {};
      for (const p of res.data) {
        const fecha = await calcularFechaMasProxima(p.id, currentModalidad);
        proximas[p.id] = fecha;
      }
      setFechasProximas(proximas);
    }
    setLoadingPsicologas(false);
  };

  // Recalcular fechas más próximas al cambiar de modalidad
  const actualizarProximasFechas = async (currentModalidad) => {
    setLoadingPsicologas(true);
    const proximas = {};
    for (const p of psicologas) {
      const fecha = await calcularFechaMasProxima(p.id, currentModalidad);
      proximas[p.id] = fecha;
    }
    setFechasProximas(proximas);
    setLoadingPsicologas(false);
  };

  // Cargar las fechas habilitadas (con al menos 1 slot libre) para el calendario
  const cargarFechasHabilitadas = async (psicologoId, currentModalidad) => {
    try {
      const hoy = new Date();
      const todayStr = hoy.toISOString().split('T')[0];
      const duracion = servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 30;

      const { data: horarios } = await supabase
        .from('horarios_empleados')
        .select('*')
        .eq('empleado_id', psicologoId)
        .eq('modalidad', currentModalidad)
        .gte('fecha', todayStr);

      const { data: citas } = await supabase
        .from('citas')
        .select('fecha_cita, hora_inicio, hora_fin, estado_cita')
        .eq('psicologo_id', psicologoId)
        .gte('fecha_cita', todayStr);

      const habilitadas = new Set();
      if (horarios) {
        const uniqueFechas = [...new Set(horarios.map(h => h.fecha))];
        for (const fecha of uniqueFechas) {
          const horariosDelDia = horarios.filter(h => h.fecha === fecha);
          const citasDelDia = (citas || []).filter(c => c.fecha_cita === fecha);
          const slotsLibres = obtenerSlotsLibresDia(horariosDelDia, citasDelDia, duracion, BUFFER_MINUTOS);
          if (slotsLibres.length > 0) {
            habilitadas.add(fecha);
          }
        }
      }
      setFechasHabilitadas(habilitadas);
    } catch (e) {
      console.error(e);
    }
  };

  // Cargar slots libres para un día específico
  const cargarSlotsDelDia = async (psicologoId, fechaStr, currentModalidad) => {
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
        .select('hora_inicio, hora_fin, estado_cita')
        .eq('psicologo_id', psicologoId)
        .eq('fecha_cita', fechaStr);

      const duracion = servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 30;
      const libres = obtenerSlotsLibresDia(horarios, citas, duracion, BUFFER_MINUTOS);

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
    if (step === 3) return psicologaSeleccionada !== null;
    if (step === 4) return fechaSeleccionada !== null && slotSeleccionado !== null;
    return true;
  };

  const nextStep = () => {
    if (puedesAvanzar()) {
      if (step === 2) {
        cargarPsicologas(servicioSeleccionado.id, modalidad);
      }
      if (step === 3) {
        cargarFechasHabilitadas(psicologaSeleccionada.id, modalidad);
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
      } else if (metodoPagoVal === 'Online (Culqi)') {
        dbMetodoPago = 'Pago Online Culqi';
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
          // It's a new package from the catalog, so we insert it into paquetes_adquiridos
          const { data: newPack, error: packErr } = await supabase
            .from('paquetes_adquiridos')
            .insert([{
              paciente_id: pacienteId,
              servicio_id: servicioSeleccionado.id,
              paquete_catalogo_id: paqueteSeleccionado.id,
              nombre_paquete_snapshot: paqueteSeleccionado.nombre_paquete,
              sesiones_totales: paqueteSeleccionado.cant_sesiones,
              sesiones_disponibles: paqueteSeleccionado.cant_sesiones, // Option B: keep all sessions available initially
              monto_pagado: paqueteSeleccionado.precio_total,
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
        modalidad: modalidad
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
      setShowCulqiModal(true);
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
                  cargarSlotsDelDia(psicologaSeleccionada.id, dateStr, modalidad);
                  setSlotSeleccionado(null);
                }}
                className={`py-2.5 rounded-xl font-bold transition-all ${isSelected
                    ? 'bg-[#003178] text-white shadow-md transform scale-105'
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
                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${isSelected
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
                        className={`p-4 rounded-xl border text-left transition-all bg-white cursor-pointer ${isSelected
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
                  className={`p-4 rounded-xl border text-left transition-all bg-white cursor-pointer ${!paqueteSeleccionado
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
                      className={`p-4 rounded-xl border text-left transition-all bg-white cursor-pointer ${isSelected
                          ? 'border-[#003178] ring-1 ring-[#003178]'
                          : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      onClick={() => setPaqueteSeleccionado(p)}
                    >
                      <p className="font-bold text-sm text-gray-900">{p.nombre_paquete}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.cant_sesiones} sesiones incluidas</p>
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
    if (loadingPsicologas) {
      return (
        <div className="flex justify-center items-center py-10">
          <div className="w-8 h-8 border-3 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2">Especialistas para este Servicio</h4>
        {psicologas.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-4 text-center">No hay especialistas disponibles para este servicio.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {psicologas.map(p => {
              const isSelected = psicologaSeleccionada?.id === p.id;
              const foto = getPsicoFoto(p.id) || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200';
              const fechaProx = fechasProximas[p.id];

              return (
                <button
                  key={p.id}
                  type="button"
                  className={`flex flex-col bg-white rounded-2xl border overflow-hidden text-left transition-all cursor-pointer ${isSelected
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
                        {fechaProx
                          ? `Disponible desde: ${new Date(fechaProx + 'T00:00:00').toLocaleDateString('es-PE')}`
                          : 'Sin disponibilidad en esta modalidad'}
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
        
        {fechasHabilitadas.size === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            No hay disponibilidad para esta modalidad con la especialista seleccionada.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* LADO IZQUIERDO: CALENDARIO */}
          <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
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
          <div className="lg:col-span-5 flex flex-col space-y-6">
            {/* Modalidad */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm shrink-0">
              <h5 className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-wider">1. Modalidad</h5>
              <div className="flex gap-4">
                <button
                  type="button"
                  className={`flex-1 py-3.5 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    modalidad === 'Presencial'
                      ? 'bg-[#003178] border-[#003178] text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={async () => {
                    if (modalidad !== 'Presencial') {
                      setModalidad('Presencial');
                      setFechaSeleccionada(null);
                      setSlotSeleccionado(null);
                      await cargarFechasHabilitadas(psicologaSeleccionada.id, 'Presencial');
                      actualizarProximasFechas('Presencial');
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                  Presencial
                </button>
                <button
                  type="button"
                  className={`flex-1 py-3.5 px-4 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    modalidad === 'Virtual'
                      ? 'bg-[#003178] border-[#003178] text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={async () => {
                    if (modalidad !== 'Virtual') {
                      setModalidad('Virtual');
                      setFechaSeleccionada(null);
                      setSlotSeleccionado(null);
                      setMetodoPago('tarjeta'); // Auto-set for virtual sessions
                      await cargarFechasHabilitadas(psicologaSeleccionada.id, 'Virtual');
                      actualizarProximasFechas('Virtual');
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">videocam</span>
                  Virtual
                </button>
              </div>
            </div>

            {/* Horarios */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col">
              <h5 className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-wider shrink-0">2. Horarios Disponibles</h5>
              {!fechaSeleccionada ? (
                <div className="flex-1 flex items-center justify-center min-h-[160px]">
                  <p className="text-xs text-gray-550 bg-white border border-gray-150 rounded-xl p-4 text-center w-full">
                    Selecciona una fecha en el calendario para ver los horarios.
                  </p>
                </div>
              ) : loadingSlots ? (
                <div className="flex-1 flex items-center justify-center min-h-[160px]">
                  <div className="w-6 h-6 border-2 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : slotsDisponibles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[160px]">
                  <p className="text-xs text-gray-550 bg-white border border-gray-150 rounded-xl p-4 text-center w-full">
                    No hay horarios libres para esta fecha.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1 min-h-[160px]">
                  {slotsDisponibles.map(slot => {
                    const isSelected = slotSeleccionado?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer h-10 flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#003178] border-[#003178] text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                        onClick={() => setSlotSeleccionado(slot)}
                      >
                        {slot.inicio}
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
                    <p className="font-bold text-sm text-gray-900">Pago en Clínica</p>
                    <p className="text-xs text-gray-500 mt-0.5">Paga en la recepción física el día de tu cita</p>
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
                    <p className="font-bold text-sm text-gray-900">Pago Online (Culqi)</p>
                    <p className="text-xs text-gray-500 mt-0.5">Usa cualquier tarjeta de crédito o débito ahora</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-[24px]">credit_card</span>
                </label>
              </div>

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
              disabled={step === 1 || savingAppointment}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
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