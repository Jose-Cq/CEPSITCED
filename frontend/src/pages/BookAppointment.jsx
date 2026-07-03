import { useState, useEffect, Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import {
  crearCita,
  obtenerMetodosPagoClinica
} from '../utils/supabaseHelpers';
import { supabase } from '../supabaseClient';

// Helper imports from previous phases
import {
  BUFFER_MINUTOS,
  parseTimeToMinutes,
  obtenerSlotsLibresDia,
  filtrarSlotsPorCapacidadLocal
} from '../utils/schedulerHelper';
import {
  formatDateStr,
  formatPhoneNumber
} from '../utils/appointmentFormatters';
import { isProfileIncomplete } from '../utils/validators';
import { obtenerPrecioAplicable } from '../utils/pricingHelper';
import { fetchAndValidateCoupon } from '../utils/couponService';

// Component imports
import ReservationSummary from '../components/ReservationSummary';
import StepPatientSelection from '../components/StepPatientSelection';
import CalendarDayCard from '../components/CalendarDayCard';
import TimeSlotCard from '../components/TimeSlotCard';
import PaymentSummaryCard from '../components/PaymentSummaryCard';
import PaymentMethodCard from '../components/PaymentMethodCard';

// Helper functions are imported from '../utils/schedulerHelper' and '../utils/appointmentFormatters'

// Helper to shorten specialist names (First Name + Father's Last Name)
const obtenerNombreCorto = (nombreCompleto) => {
  if (!nombreCompleto) return '';
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 1) return nombreCompleto;
  if (partes.length === 2) return `${partes[0]} ${partes[1]}`;
  if (partes.length === 3) return `${partes[0]} ${partes[1]}`;
  if (partes.length === 4) return `${partes[0]} ${partes[2]}`;
  return `${partes[0]} ${partes[partes.length - 2]}`;
};

const BookAppointment = () => {
  const navigate = useNavigate();
  const { loading: loadingProfile, perfilUsuario, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();

  // State for services blocked by existing pending citas
  const [serviciosBloqueados, setServiciosBloqueados] = useState(new Set());

  // Wizard state (indexed steps)
  const [stepIndex, setStepIndex] = useState(0);
  const [paraQuien, setParaQuien] = useState('yo'); // 'yo' o 'familiar'
  const [familiarId, setFamiliarId] = useState('');
  const [modalidad, setModalidad] = useState(''); // Starts empty
  const [localSeleccionado, setLocalSeleccionado] = useState(null);

  // Unified preloaded database data state
  const [dbData, setDbData] = useState({
    locales: [],
    servicios: [],
    rooms: [],
    employees: [],
    psicologoServicio: [],
    horarios: [],
    citas: [],
    reglasPrecios: [],
    asignaciones: [],
    areas: [],
    cargos: [],
    paquetesCatalogo: [],
    loading: true,
    error: null
  });

  // Load all required data on component mount
  useEffect(() => {
    const loadAllDbData = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const [
          { data: localesData, error: errLocales },
          { data: serviciosData, error: errServicios },
          { data: roomsData, error: errRooms },
          { data: employeesData, error: errEmployees },
          { data: psServData, error: errPsServ },
          { data: horariosData, error: errHorarios },
          { data: citasData, error: errCitas },
          { data: reglasPreciosData, error: errReglasPrecios },
          { data: asignacionesData, error: errAsignaciones },
          { data: areasData, error: errAreas },
          { data: cargosData, error: errCargos },
          { data: paquetesCatalogoData, error: errPaquetesCatalogo }
        ] = await Promise.all([
          supabase.from('locales').select('*').eq('activo', true),
          supabase.from('servicios').select('*').eq('activo', true),
          supabase.from('habitaciones').select('*').eq('activo', true),
          supabase.from('empleados').select('*').eq('activo', true),
          supabase.from('psicologo_servicio').select('*'),
          supabase.from('horarios_empleados').select('*').gte('fecha', tomorrowStr),
          supabase.from('citas').select('id, fecha_cita, hora_inicio, hora_fin, estado_cita, psicologo_id, habitacion_id, modalidad').gte('fecha_cita', tomorrowStr).in('estado_cita', ['Pendiente', 'Confirmado', 'Confirmada', 'Reprogramada', 'En consulta', 'En Consulta']),
          supabase.from('reglas_precios').select('*'),
          supabase.from('asignaciones_empleado').select('*'),
          supabase.from('areas').select('*').eq('activo', true),
          supabase.from('cargos').select('*'),
          supabase.from('paquetes_catalogo').select('*').eq('activo', true)
        ]);

        if (errLocales) throw errLocales;
        if (errServicios) throw errServicios;
        if (errRooms) throw errRooms;
        if (errEmployees) throw errEmployees;
        if (errPsServ) throw errPsServ;
        if (errHorarios) throw errHorarios;
        if (errCitas) throw errCitas;
        if (errReglasPrecios) throw errReglasPrecios;
        if (errAsignaciones) throw errAsignaciones;
        if (errAreas) throw errAreas;
        if (errCargos) throw errCargos;
        if (errPaquetesCatalogo) throw errPaquetesCatalogo;

        const mappedEmployees = (employeesData || []).map(emp => {
          let cargoId = emp.cargo_id || null;
          if (!cargoId && asignacionesData) {
            const empAsignaciones = asignacionesData.filter(a => a.empleado_id === emp.id);
            const asigConCargo = empAsignaciones.find(a => a.cargo_id);
            if (asigConCargo) {
              cargoId = asigConCargo.cargo_id;
            }
          }
          
          let prefix = '';
          if (cargoId && cargosData) {
            const cargo = cargosData.find(c => c.id === cargoId);
            if (cargo) {
              const nombreCargo = cargo.nombre || '';
              if (nombreCargo.includes('Doctor')) prefix = 'Dra. ';
              else if (nombreCargo.includes('Magister')) prefix = 'Mg. ';
              else if (nombreCargo.includes('Licenciado')) prefix = 'Lic. ';
            }
          }

          const baseName = `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim();
          return {
            ...emp,
            cargo_id: cargoId,
            nombres_apellidos: prefix ? `${prefix}${baseName}` : baseName
          };
        });

        setDbData({
          locales: localesData || [],
          servicios: serviciosData || [],
          rooms: roomsData || [],
          employees: mappedEmployees,
          psicologoServicio: psServData || [],
          horarios: horariosData || [],
          citas: citasData || [],
          reglasPrecios: reglasPreciosData || [],
          asignaciones: asignacionesData || [],
          areas: areasData || [],
          cargos: cargosData || [],
          paquetesCatalogo: paquetesCatalogoData || [],
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

  // Load blocked services (pending citas for current patient per service)
  useEffect(() => {
    const checkBloqueos = async () => {
      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : familiarId;
      if (!pacienteId || dbData.loading || loadingProfile) {
        setServiciosBloqueados(new Set());
        return;
      }
      const { data, error } = await supabase
        .from('citas')
        .select('servicio')
        .eq('paciente_id', pacienteId)
        .neq('estado_cita', 'Cancelado')
        .neq('estado_cita', 'Cancelada')
        .neq('estado_pago', 'Rechazado')
        .or('estado_cita.eq.Pendiente,estado_pago.eq.Pendiente');

      if (!error && data) {
        setServiciosBloqueados(new Set(data.map(c => c.servicio)));
      }
    };
    checkBloqueos();
  }, [paraQuien, familiarId, perfilClinicoPropio?.id_paciente, dbData.loading]);

  // Search query for services
  const [buscarServicio, setBuscarServicio] = useState('');
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  
  const [tipoSesion, setTipoSesion] = useState('normal'); // 'normal' o 'paquete'
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState(null);
  const [activePatientPackages, setActivePatientPackages] = useState([]);

  const [psicologaSeleccionada, setPsicologaSeleccionada] = useState(null);



  // Search mode state variables
  const [modoBusqueda, setModoBusqueda] = useState('servicio'); // 'servicio' o 'especialista'
  const [servicioExpandidoId, setServicioExpandidoId] = useState(null);
  
  const [fechasHabilitadas, setFechasHabilitadas] = useState(new Set());
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [slotsDisponibles, setSlotsDisponibles] = useState([]);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    // Si hoy está en el mes actual, avanzar para que el mínimo sea mañana
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getMonth() !== d.getMonth() || tomorrow.getFullYear() !== d.getFullYear()) {
      // Si mañana es otro mes, mostrar el mes de mañana
      return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1);
    }
    return d;
  });

  const [comentario, setComentario] = useState('');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [tempComentario, setTempComentario] = useState('');
  const [metodoPago, setMetodoPago] = useState('clinica'); // 'clinica' o 'tarjeta'

  // Lógica de control de cambios de especialista
  const [showFirstChangeModal, setShowFirstChangeModal] = useState(false);
  const [showSecondChangeModal, setShowSecondChangeModal] = useState(false);
  const [showBlockedChangeModal, setShowBlockedChangeModal] = useState(false);
  const [tempEspecialista, setTempEspecialista] = useState(null);
  const [lastPsychologist, setLastPsychologist] = useState(null);
  const [comentarioCambio, setComentarioCambio] = useState('');
  const [receptionPhone, setReceptionPhone] = useState('');
  const [cambiosEspecialistaCount, setCambiosEspecialistaCount] = useState(0);
  
  const [metodosPagoClinica, setMetodosPagoClinica] = useState([]);
  const [loadingMetodosPago, setLoadingMetodosPago] = useState(false);
  const [metodoPagoOnlineDetalle, setMetodoPagoOnlineDetalle] = useState('TRANSFERENCIA');
  const [showCulqiModal, setShowCulqiModal] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalRedirectOnClose, setPaymentModalRedirectOnClose] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Cupón / Convenio state
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  // Dynamic steps declaration based on modality
  const steps = useMemo(() => {
    return [
      { id: 'paciente_modalidad_local', label: 'Paciente' },
      { id: 'servicio_psicologo', label: 'Servicios' },
      { id: 'horario', label: 'Fecha y Horario' },
      { id: 'pago', label: 'Pago' }
    ];
  }, []);

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

  // Set default active payment method detail when metodosPagoClinica loads
  useEffect(() => {
    if (metodosPagoClinica && metodosPagoClinica.length > 0) {
      const activeTypes = [...new Set(metodosPagoClinica.map(m => m.tipo))];
      if (activeTypes.length > 0 && !activeTypes.includes(metodoPagoOnlineDetalle)) {
        setMetodoPagoOnlineDetalle(activeTypes[0]);
      }
    }
  }, [metodosPagoClinica, metodoPagoOnlineDetalle]);

  // Fetch active patient prepaid packages once on patient change
  useEffect(() => {
    const cargarPaquetesPaciente = async () => {
      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : familiarId;
      if (!pacienteId) {
        setActivePatientPackages([]);
        return;
      }
      try {
        const { data: packs, error: packsErr } = await supabase
          .from('paquetes_adquiridos')
          .select('*')
          .eq('paciente_id', pacienteId)
          .gt('sesiones_disponibles', 0);

        if (packsErr) throw packsErr;
        if (!packs || packs.length === 0) {
          setActivePatientPackages([]);
          return;
        }

        const packsWithNet = await Promise.all(packs.map(async (p) => {
          const { count, error: countErr } = await supabase
            .from('citas')
            .select('*', { count: 'exact', head: true })
            .eq('paquete_id', p.id)
            .in('estado_cita', ['Pendiente', 'Confirmado', 'Reprogramada']);

          if (countErr) throw countErr;
          const netas = p.sesiones_disponibles - (count || 0);
          return {
            ...p,
            citas_pendientes: count || 0,
            sesiones_netas: netas
          };
        }));

        setActivePatientPackages(packsWithNet.filter(p => p.sesiones_netas > 0));
      } catch (err) {
        console.error('Error al cargar paquetes del paciente:', err);
        setActivePatientPackages([]);
      }
    };

    cargarPaquetesPaciente();
  }, [paraQuien, familiarId, perfilClinicoPropio]);

  const esClinicoIncompletoYo = isProfileIncomplete(perfilClinicoPropio);
  const selectedDependent = perfilesDependientes?.find(d => d.id_paciente === familiarId);
  const esClinicoIncompletoFamiliar = familiarId ? isProfileIncomplete(selectedDependent) : false;

  // Final price memo using pricingHelper utility
  const precioFinalCalculado = useMemo(() => {
    if (!servicioSeleccionado) return 0;
    
    // Si es un paquete ya adquirido, el precio de programar la sesión es S/ 0
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

  // Active local selection memo
  const activeLocal = useMemo(() => {
    return localSeleccionado;
  }, [localSeleccionado]);

  // ----------------------------------------------------
  // AVAILABILITY SOLVERS (COMPLETELY LOCAL/SYNCHRONOUS)
  // ----------------------------------------------------

  const filtrarSlotsPorLocal = (slots, fecha, localRooms, duracion) => {
    if (!localRooms || localRooms.length === 0) return slots;
    const allCitasDelDia = dbData.citas.filter(c => c.fecha_cita === fecha);
    return filtrarSlotsPorCapacidadLocal(slots, allCitasDelDia, localRooms, duracion);
  };

  // 1. Check if a local has real availability for presencial/virtual modality
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

  // 2. Check if a service has real availability
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

  // 3. Check if a specialist has real availability
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

  // 4. Calculate earliest available date for specialist
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

  // 5. Calculate active dates for a specialist
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

  // 6. Get slots for a specific date
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

  // 7. Check if a modality has real availability (Cascading solver)
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

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------

  // Filter specialists strictly according to system rules:
  // 1. System role is 'Psicóloga'
  // 2. Has services assigned to their profile
  // 3. Active and offers services on the platform
  const especialistasElegibles = useMemo(() => {
    return dbData.employees.filter(emp => {
      if (!emp) return false;
      const rol = (emp.rol_sistema || '').toLowerCase();
      const esPsicologa = rol.includes('psicólog') || rol.includes('psicolog');
      if (!esPsicologa) return false;

      const estaActiva = emp.activo && emp.ofrece_servicios !== false;
      if (!estaActiva) return false;

      const tieneServicios = (dbData.psicologoServicio || []).some(ps =>
        ps && ps.psicologo_id === emp.id &&
        (dbData.servicios || []).some(s => s && s.id === ps.servicio_id && s.activo)
      );
      if (!tieneServicios) return false;

      if (modalidad === 'Virtual') {
        if (!localSeleccionado) return false;
        const tieneBloquesVirtuales = (dbData.horarios || []).some(h =>
          h && h.empleado_id === emp.id &&
          h.modalidad === 'Virtual' &&
          h.local_id === localSeleccionado.id &&
          h.disponible &&
          h.tipo !== 'salida' &&
          h.tipo !== 'otro'
        );
        if (!tieneBloquesVirtuales) return false;
      }

      return true;
    });
  }, [dbData.employees, dbData.psicologoServicio, dbData.servicios, dbData.horarios, modalidad, localSeleccionado]);

  // Helper to map specialty area name for a specialist
  const getEspecialidadEspecialista = (empId) => {
    const empAsignaciones = (dbData.asignaciones || []).filter(a => a && a.empleado_id === empId);
    const areaNames = empAsignaciones.map(a => {
      const area = (dbData.areas || []).find(ar => ar && ar.id === a.area_id);
      return area ? area.nombre : null;
    }).filter(Boolean);
    const areasUnicas = [...new Set(areaNames)];
    return areasUnicas.length > 0 ? areasUnicas.join(', ') : 'Psicología General';
  };

  // Valid locals passing checkLocalAvailability
  const validLocales = useMemo(() => {
    const modToCheck = modalidad || 'Presencial';
    return (dbData.locales || []).filter(l => l && checkLocalAvailability(l.id, modToCheck));
  }, [dbData.locales, dbData.horarios, dbData.citas, dbData.rooms, dbData.servicios, dbData.employees, dbData.psicologoServicio, modalidad]);

  // Locales with at least one active non-tramite service
  const sedesConServicios = useMemo(() => {
    return (dbData.locales || []).filter(local =>
      (dbData.servicios || []).some(s =>
        s && s.activo && !s.es_tramite &&
        (s.local_id === local.id || (Array.isArray(s.locales_ids) && s.locales_ids.includes(local.id)))
      )
    );
  }, [dbData.locales, dbData.servicios]);

  // Set default local if none selected or no longer valid
  useEffect(() => {
    if (validLocales.length > 0) {
      if (!localSeleccionado || !validLocales.some(l => l && l.id === localSeleccionado?.id)) {
        setLocalSeleccionado(validLocales[0]);
      }
    }
  }, [validLocales, localSeleccionado]);

  // Helper: true if service has any valid pricing (base, reglas_precios, or packages)
  const serviceHasPricing = (s) => {
    if (Number(s.precio_sesion || 0) > 0) return true;
    if ((dbData.reglasPrecios || []).some(r => r.servicio_id === s.id && (Number(r.precio || 0) > 0 || Number(r.descuento_porcentaje || 0) > 0))) return true;
    if ((dbData.paquetesCatalogo || []).some(p => p.servicio_id === s.id && Number(p.precio_total || 0) > 0)) return true;
    return false;
  };

  // Helper: rank academic hierarchy for specialist sorting
  const getJerarquia = (nombre) => {
    if (!nombre) return 4;
    if (nombre.startsWith('Dra.') || nombre.startsWith('Dr.')) return 1;
    if (nombre.startsWith('Mg.')) return 2;
    if (nombre.startsWith('Lic.')) return 3;
    return 4;
  };

  // Filter services dynamically based on modoBusqueda
  const serviciosFiltrados = useMemo(() => {
    if (modoBusqueda === 'servicio') {
      return dbData.servicios.filter(s => {
        if (!s) return false;
        if (s.es_tramite) return false;
        if (!serviceHasPricing(s)) return false;
        if (buscarServicio.trim() !== '') {
          const query = buscarServicio.toLowerCase();
          if (!(s.nombre_servicio || '').toLowerCase().includes(query)) {
            return false;
          }
        }

        if (!localSeleccionado) return false;
        const isAssociated = s.local_id === localSeleccionado.id || (Array.isArray(s.locales_ids) && s.locales_ids.includes(localSeleccionado.id));
        if (!isAssociated) return false;

        const hasSpecialist = (especialistasElegibles || []).some(emp =>
          emp && (dbData.psicologoServicio || []).some(ps => ps && ps.psicologo_id === emp.id && ps.servicio_id === s.id)
        );
        if (!hasSpecialist) return false;

        return checkServiceAvailability(s, modalidad, localSeleccionado?.id);
      }).sort((a, b) => (a.nombre_servicio || '').localeCompare(b.nombre_servicio || ''));
    } else {
      // Buscar por especialista: mostrar servicios de la especialista seleccionada
      if (!psicologaSeleccionada) return [];
      return dbData.servicios.filter(s => {
        if (!s) return false;
        if (s.es_tramite) return false;
        if (!serviceHasPricing(s)) return false;
        if (buscarServicio.trim() !== '') {
          const query = buscarServicio.toLowerCase();
          if (!(s.nombre_servicio || '').toLowerCase().includes(query)) return false;
        }
        
        if (!localSeleccionado) return false;
        const isAssociated = s.local_id === localSeleccionado.id || (Array.isArray(s.locales_ids) && s.locales_ids.includes(localSeleccionado.id));
        if (!isAssociated) return false;

        const offersService = (dbData.psicologoServicio || []).some(ps =>
          ps && ps.psicologo_id === psicologaSeleccionada.id && ps.servicio_id === s.id
        );
        if (!offersService) return false;
        return checkSpecialistAvailability(psicologaSeleccionada, s, modalidad, localSeleccionado?.id);
      }).sort((a, b) => (a.nombre_servicio || '').localeCompare(b.nombre_servicio || ''));
    }
  }, [modoBusqueda, dbData.servicios, dbData.reglasPrecios, dbData.paquetesCatalogo, psicologaSeleccionada, modalidad, localSeleccionado, buscarServicio, dbData.horarios, dbData.citas, dbData.rooms, dbData.employees, dbData.psicologoServicio, especialistasElegibles]);

  // Filter specialists
  const especialistasFiltrados = useMemo(() => {
    if (modoBusqueda === 'servicio') {
      if (!servicioSeleccionado) return [];
      return especialistasElegibles.filter(emp => {
        if (!emp) return false;
        // 1. Debe estar asignada al servicio seleccionado
        const offersService = (dbData.psicologoServicio || []).some(ps =>
          ps && ps.psicologo_id === emp.id && ps.servicio_id === servicioSeleccionado.id
        );
        if (!offersService) return false;

        // 2. Debe tener disponibilidad para la modalidad y local seleccionados
        return checkSpecialistAvailability(emp, servicioSeleccionado, modalidad, localSeleccionado?.id);
      });
    } else {
      // Buscar por especialista: mostrar especialistas disponibles para al menos uno de sus servicios
      return especialistasElegibles.filter(emp => {
        if (!emp) return false;
        const empServiceIds = (dbData.psicologoServicio || [])
          .filter(ps => ps && ps.psicologo_id === emp.id)
          .map(ps => ps?.servicio_id);
        
        return (dbData.servicios || []).some(s => 
          s && empServiceIds.includes(s.id) &&
          checkSpecialistAvailability(emp, s, modalidad, localSeleccionado?.id)
        );
      });
    }
  }, [modoBusqueda, especialistasElegibles, servicioSeleccionado, modalidad, localSeleccionado, dbData.servicios, dbData.psicologoServicio, dbData.horarios, dbData.citas, dbData.rooms]);

  // Calculate dates proximas for filtered specialists
  const especialistasConFecha = useMemo(() => {
    return especialistasFiltrados.map(emp => {
      if (!emp) return null;
      const fechaProx = calcularFechaMasProxima(emp.id, modalidad, localSeleccionado?.id);
      return { ...emp, fechaProx };
    }).filter(emp => emp && emp.fechaProx !== null)
    .sort((a, b) => {
      const rankA = getJerarquia(a.nombres_apellidos);
      const rankB = getJerarquia(b.nombres_apellidos);
      if (rankA !== rankB) return rankA - rankB;
      return (a.nombres_apellidos || '').localeCompare(b.nombres_apellidos || '');
    });
  }, [especialistasFiltrados, modalidad, localSeleccionado, dbData.horarios, dbData.citas, dbData.rooms, servicioSeleccionado, modoBusqueda]);

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
    setServicioExpandidoId(null);
    setComentarioCambio('');
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
    setServicioExpandidoId(null);
    setComentarioCambio('');
    
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
    setServicioExpandidoId(null);
    setComentarioCambio('');
  };

  const handleServiceHeaderClick = async (service) => {
    if (!service) return;
    const estaBloqueado = serviciosBloqueados.has(service.nombre_servicio);
    if (servicioExpandidoId === service.id) {
      setServicioExpandidoId(null);
      setServicioSeleccionado(null);
      setTipoSesion('normal');
      setPaqueteSeleccionado(null);
      if (modoBusqueda === 'servicio') {
        setPsicologaSeleccionada(null);
      }
      setFechaSeleccionada(null);
      setSlotSeleccionado(null);
      setComentarioCambio('');
      setReceptionPhone('');
    } else if (estaBloqueado) {
      toast.error('Ya cuentas con una sesión pendiente para este servicio. Para agendar la siguiente sesión, debes concluir tu cita anterior.');
    } else {
      setServicioExpandidoId(service.id);
      setServicioSeleccionado(service);
      setComentarioCambio('');
      setReceptionPhone('');
      
      const resolvedPrice = obtenerPrecioAplicable({
        servicio: service,
        paqueteCatalogo: null,
        especialista: psicologaSeleccionada,
        reglasPrecios: dbData.reglasPrecios,
        localId: localSeleccionado?.id || null,
        modalidad: modalidad,
        asignaciones: dbData.asignaciones,
        cargos: dbData.cargos
      }).precioFinal;

      setTipoSesion(resolvedPrice > 0 ? 'normal' : 'paquete');
      setPaqueteSeleccionado(null);

      // Pre-select the last active psychologist for this service
      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : familiarId;
      if (pacienteId && !psicologaSeleccionada) {
        try {
          const { data: history, error } = await supabase
            .from('citas')
            .select('id, psicologo_id, psicologa_nombre, fecha_cita, hora_inicio, estado_cita, estado_pago')
            .eq('paciente_id', pacienteId)
            .eq('servicio', service.nombre_servicio)
            .neq('estado_cita', 'Cancelado')
            .neq('estado_cita', 'Cancelada')
            .order('fecha_cita', { ascending: false })
            .order('hora_inicio', { ascending: false });

          if (!error && history && history.length > 0) {
            const valid = history.filter(c =>
              c.estado_cita === 'Atendido' ||
              c.estado_cita === 'Pendiente' ||
              c.estado_pago === 'Pagado'
            );
            if (valid.length > 0) {
              const lastPsychId = valid[0].psicologo_id;
              const matchedEmp = dbData.employees.find(e => e.id === lastPsychId);
              if (matchedEmp) {
                setPsicologaSeleccionada(matchedEmp);
                setCambiosEspecialistaCount(0); // Continuity
              }
            }
          }
        } catch (e) {
          console.error("Error pre-selecting last specialist:", e);
        }
      } else if (psicologaSeleccionada) {
        // In search by specialist, do not reset if already compatible. Otherwise reset specialist.
        const isCompatible = (dbData.psicologoServicio || []).some(ps => 
          ps.psicologo_id === psicologaSeleccionada.id && ps.servicio_id === service.id
        );
        if (!isCompatible) {
          setPsicologaSeleccionada(null);
          setFechaSeleccionada(null);
          setSlotSeleccionado(null);
        }
      }
    }
  };

  const cleanName = (name) => {
    if (!name || typeof name !== 'string') return "";
    return name.replace(/^(Dra\.|Lic\.|Dr\.|Mg\.|Psic\.)\s*/i, "").trim().toLowerCase();
  };

  const fetchReceptionPhone = async () => {
    try {
      let targetLocalIds = [];
      if (localSeleccionado?.id) {
        targetLocalIds = [localSeleccionado.id];
      } else if (sedesConServicios?.[0]?.id) {
        targetLocalIds = [sedesConServicios[0].id];
      }
      if (targetLocalIds.length === 0) return;

      const { data: asignaciones } = await supabase
        .from('asignaciones_empleado')
        .select('empleado_id')
        .in('local_id', targetLocalIds);
      if (!asignaciones || asignaciones.length === 0) return;

      const empIds = [...new Set(asignaciones.map(a => a.empleado_id))];

      const { data: receptionist } = await supabase
        .from('empleados')
        .select('telefono')
        .eq('rol_sistema', 'Recepción')
        .eq('activo', true)
        .in('id', empIds)
        .limit(1)
        .maybeSingle();

      if (receptionist?.telefono) {
        setReceptionPhone(receptionist.telefono);
      }
    } catch (_) {
      // Silently fail — phone is optional
    }
  };

  const handleEspecialistaChange = async (nuevoEspecialista) => {
    try {
      setBookingError('');
      if (psicologaSeleccionada?.id === nuevoEspecialista?.id) return;
      if (!nuevoEspecialista) {
        setPsicologaSeleccionada(null);
        resetHorariosState();
        return;
      }

      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : familiarId;
      if (!pacienteId || !servicioSeleccionado) {
        setPsicologaSeleccionada(nuevoEspecialista);
        resetHorariosState();
        return;
      }

      const { data: history, error } = await supabase
        .from('citas')
        .select('id, psicologo_id, psicologa_nombre, fecha_cita, hora_inicio, estado_cita, estado_pago')
        .eq('paciente_id', pacienteId)
        .eq('servicio', servicioSeleccionado.nombre_servicio)
        .neq('estado_cita', 'Cancelado')
        .neq('estado_cita', 'Cancelada')
        .order('fecha_cita', { ascending: false })
        .order('hora_inicio', { ascending: false });

      if (error) throw error;

      if (!history || history.length === 0) {
        setPsicologaSeleccionada(nuevoEspecialista);
        resetHorariosState();
        return;
      }

      const historialValido = history.filter(c =>
        c.estado_cita === 'Atendido' ||
        c.estado_cita === 'Pendiente' ||
        c.estado_pago === 'Pagado'
      );

      if (historialValido.length === 0) {
        setPsicologaSeleccionada(nuevoEspecialista);
        resetHorariosState();
        return;
      }

      const targetEmp = nuevoEspecialista || {};
      const nuevoNombre = targetEmp.nombres
        ? `${targetEmp.nombres || ''} ${targetEmp.apellido_paterno || ''} ${targetEmp.apellido_materno || ''}`.trim()
        : (targetEmp.nombres_apellidos || '');
      const cleanNuevo = cleanName(nuevoNombre);

      const listaCronologica = [...historialValido].sort((a, b) => new Date(a.fecha_cita || a.created_at) - new Date(b.fecha_cita || b.created_at));

      let cambiosPasados = 0;
      for (let i = 1; i < listaCronologica.length; i++) {
        const prev = cleanName(listaCronologica[i - 1].psicologa_nombre);
        const curr = cleanName(listaCronologica[i].psicologa_nombre);
        if (prev && curr && prev !== curr) {
          cambiosPasados++;
        }
      }

      const ultimaCita = listaCronologica[listaCronologica.length - 1];
      const ultimaPsicologa = cleanName(ultimaCita?.psicologa_nombre);

      if (cleanNuevo === ultimaPsicologa) {
        setPsicologaSeleccionada(nuevoEspecialista);
        resetHorariosState();
        setCambiosEspecialistaCount(0);
        return;
      }

      const lastEmp = dbData.employees.find(e => e.id === ultimaCita.psicologo_id) || {
        id: ultimaCita.psicologo_id,
        nombres_apellidos: ultimaCita.psicologa_nombre
      };
      setLastPsychologist(lastEmp);
      setTempEspecialista(nuevoEspecialista);

      const totalCambios = cambiosPasados + 1;
      setCambiosEspecialistaCount(totalCambios);

      const showModal = (fn) => setTimeout(() => fn(), 0);

      if (totalCambios >= 3) {
        showModal(() => {
          setShowBlockedChangeModal(true);
          fetchReceptionPhone();
        });
      } else if (totalCambios === 2) {
        showModal(() => setShowSecondChangeModal(true));
      } else {
        showModal(() => setShowFirstChangeModal(true));
      }
    } catch (err) {
      console.error('Error al verificar historial de cambios:', err);
      setPsicologaSeleccionada(nuevoEspecialista);
      resetHorariosState();
    }
  };

  const resetHorariosState = () => {
    setFechaSeleccionada(null);
    setSlotSeleccionado(null);
    setSlotsDisponibles([]);
    setFechasHabilitadas(new Set());
  };

  const puedesAvanzar = () => {
    const currentStepId = steps[stepIndex]?.id;
    if (currentStepId === 'paciente_modalidad_local') {
      const pacienteValid = paraQuien === 'yo'
        ? !esClinicoIncompletoYo
        : (familiarId !== '' && !esClinicoIncompletoFamiliar);
      if (!pacienteValid) return false;
      if (!modalidad) return false;
      if (modalidad === 'Presencial' && !localSeleccionado) return false;
      return true;
    }
    if (currentStepId === 'servicio_psicologo') {
      if (!servicioSeleccionado) return false;
      if (tipoSesion === 'paquete' && !paqueteSeleccionado) return false;
      return psicologaSeleccionada !== null;
    }
    if (currentStepId === 'horario') {
      return fechaSeleccionada !== null && slotSeleccionado !== null;
    }
    return true;
  };

  const nextStep = () => {
    setBookingError('');
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
          setStepIndex(targetIndex);
          return;
        }

        setStepIndex(targetIndex);
      }
    }
  };

  const prevStep = () => {
    setBookingError('');
    const targetIndex = stepIndex - 1;
    if (targetIndex >= 0) {
      setStepIndex(targetIndex);
    }
  };

  // ----------------------------------------------------
  // SUBMISSION LOGIC
  // ----------------------------------------------------

  const saveAppointment = async (estadoPago, metodoPagoVal) => {
    if (dbData.loading || loadingProfile) {
      return { success: false, error: 'Los datos aún se están cargando. Intenta de nuevo en un momento.' };
    }
    setSavingAppointment(true);
    setBookingError('');
    try {
      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : familiarId;
      const dateStr = formatDateStr(fechaSeleccionada?.getFullYear(), fechaSeleccionada?.getMonth(), fechaSeleccionada?.getDate());

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

      const priceVal = couponData ? precioConDescuento : precioFinalCalculado;

      let dbHabitacionId = null;
      if (activeLocal) {
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
            .in('estado_cita', ['Pendiente', 'Confirmado', 'Confirmada', 'Reprogramada', 'En consulta', 'En Consulta']);

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

      const cleanPsicologaNombre = `${psicologaSeleccionada.nombres || ''} ${psicologaSeleccionada.apellido_paterno || ''} ${psicologaSeleccionada.apellido_materno || ''}`.trim();

      const isPromoApplied = paqueteSeleccionado?.type !== 'adquirido' && (() => {
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
        return !!res.tienePromocion;
      })();

      const cita = {
        paciente_id: pacienteId,
        psicologo_id: psicologaSeleccionada.id,
        psicologa_nombre: cleanPsicologaNombre,
        servicio: servicioSeleccionado.nombre_servicio,
        fecha_cita: dateStr,
        hora_inicio: slotSeleccionado.hora_inicio,
        hora_fin: slotSeleccionado.hora_fin,
        estado_cita: 'Pendiente',
        estado_pago: estadoPago,
        metodo_pago: null,
        tipo_pago: dbMetodoPago,
        monto: priceVal,
        comentario_paciente: comentario,
        paquete_id: dbPaqueteId,
        modalidad: modalidad,
        habitacion_id: dbHabitacionId,
        local_id: activeLocal?.id || null,
        comentario_cambio_psicologo: comentarioCambio,
        cupon_id: couponData ? couponData.id : null,
        cupon_aplicado: couponData ? true : false,
        promocion_aplicada: isPromoApplied ? true : false
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
        toast.success('Cita agendada correctamente utilizando tu paquete.', { duration: 4000 });
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
        toast.success('Cita agendada correctamente. Recuerda realizar el pago en recepción el día de tu consulta.', { duration: 5000 });
        navigate('/dashboard/appointments');
      } else {
        setBookingError(res.error || 'Error al guardar la cita.');
      }
    }
  };

  // ----------------------------------------------------
  // HELPERS AND CONTROLS
  // ----------------------------------------------------

  const handleStepClick = (stepId) => {
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx !== -1 && idx < stepIndex) {
      setStepIndex(idx);
    }
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

  const handleApplyCoupon = async () => {
    setCouponError('');
    setCouponSuccess('');
    setCouponData(null);
    if (!couponCode.trim()) {
      setCouponError('Ingresa un código de cupón.');
      return;
    }
    setCouponLoading(true);
    try {
      const codigo = couponCode.trim().toUpperCase();
      const { data: coupon, error: couponErr } = await supabase
        .from('cupones')
        .select('*')
        .eq('codigo', codigo)
        .eq('activo', true)
        .maybeSingle();

      if (couponErr) throw couponErr;
      if (!coupon) {
        setCouponError('Cupón inválido o inactivo.');
        return;
      }

      const todayStr = new Date().toLocaleDateString('sv-SE');
      if (coupon.fecha_inicio && todayStr < coupon.fecha_inicio) {
        setCouponError('El cupón aún no está vigente.');
        return;
      }
      if (coupon.fecha_fin && todayStr > coupon.fecha_fin) {
        setCouponError('El cupón ha caducado.');
        return;
      }
      if (coupon.cantidad_usos_maximo !== null && coupon.cantidad_usos_actual >= coupon.cantidad_usos_maximo) {
        setCouponError('El cupón ha alcanzado su límite de usos.');
        return;
      }
      if (coupon.servicio_id && coupon.servicio_id !== servicioSeleccionado?.id) {
        setCouponError('Este cupón no aplica para el servicio seleccionado.');
        return;
      }
      if (coupon.paquete_catalogo_id && coupon.paquete_catalogo_id !== paqueteSeleccionado?.id) {
        setCouponError('Este cupón no aplica para el paquete seleccionado.');
        return;
      }

      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : familiarId;
      if (!pacienteId) {
        setCouponError('Debes seleccionar un paciente antes de aplicar el cupón.');
        return;
      }

      if (coupon.un_uso_por_paciente) {
        const { data: usoExistente, error: usoErr } = await supabase
          .from('cupones_usos')
          .select('id')
          .eq('cupon_id', coupon.id)
          .eq('paciente_id', pacienteId)
          .limit(1);

        if (usoErr) throw usoErr;
        if (usoExistente && usoExistente.length > 0) {
          setCouponError('Ya has utilizado este cupón anteriormente.');
          return;
        }
      }

      if (coupon.tipo_cupon === 'Empresa') {
        const { data: vinculo, error: vinculoErr } = await supabase
          .from('empresa_pacientes')
          .select('id, empresa_id')
          .eq('paciente_id', pacienteId)
          .limit(1);

        if (vinculoErr) throw vinculoErr;
        if (!vinculo || vinculo.length === 0) {
          setCouponError('Este cupón es exclusivo para pacientes de empresas. No perteneces a ninguna empresa vinculada.');
          return;
        }
      }

      setCouponData(coupon);
      let descText = '';
      if (coupon.tipo_descuento === 'Porcentaje') {
        descText = `${coupon.valor_descuento}% de descuento`;
      } else if (coupon.tipo_descuento === 'Monto') {
        descText = `S/ ${coupon.valor_descuento} de descuento`;
      }
      setCouponSuccess(`Cupón aplicado: ${descText}`);
    } catch (err) {
      setCouponError(err.message || 'Error al validar el cupón.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponData(null);
    setCouponError('');
    setCouponSuccess('');
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

  // renderAppointmentSummary was removed as we now use ReservationSummary component.

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
              <CalendarDayCard
                key={`day-${d}`}
                day={d}
                isSelected={isSelected}
                isEnabled={isEnabled}
                onClick={() => {
                  const newDate = new Date(año, mes, d);
                  setFechaSeleccionada(newDate);
                  const slots = cargarSlotsDelDia(psicologaSeleccionada.id, dateStr, modalidad, activeLocal?.id);
                  setSlotsDisponibles(slots);
                  setSlotSeleccionado(null);
                }}
              />
            );
          })}
        </div>
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

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
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
                      <TimeSlotCard
                        key={slot.id}
                        inicio={slot.inicio}
                        fin={slot.fin}
                        isSelected={isSelected}
                        onClick={() => setSlotSeleccionado(slot)}
                      />
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
          <PaymentSummaryCard
            pacienteNombre={pacienteNombre}
            especialistaNombre={psicologaSeleccionada?.nombres_apellidos}
            servicioNombre={servicioSeleccionado?.nombre_servicio}
            modalidad={modalidad}
            localNombre={activeLocal?.nombre || 'Local Central'}
            fechaHoraTexto={`${fechaSeleccionada?.toLocaleDateString('es-PE')} de ${slotSeleccionado?.hora_inicio?.slice(0, 5) || '--:--'} a ${slotSeleccionado?.hora_fin?.slice(0, 5) || '--:--'}`}
            comentario={comentario}
          />

          <div className="md:col-span-5 space-y-4">
            <PaymentMethodCard
              paqueteSeleccionado={paqueteSeleccionado}
              metodoPago={metodoPago}
              modalidad={modalidad}
              precioFinal={couponData ? precioConDescuento : precioFinalCalculado}
              onMetodoPagoChange={setMetodoPago}
              onVerDatosPagoClick={() => setShowPaymentModal(true)}
            />

            {/* Cupón / Código de Descuento */}
            {paqueteSeleccionado?.type !== 'adquirido' && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                <h5 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
                  Cupón o Código de Descuento
                </h5>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); setCouponSuccess(''); }}
                    placeholder="Ingresa tu código"
                    disabled={!!couponData}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-[#003178] outline-none text-gray-700 font-medium disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  {couponData ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="px-3 py-2 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Quitar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-4 py-2 text-xs font-bold text-white bg-[#003178] rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                    >
                      {couponLoading ? 'Validando...' : 'Aplicar'}
                    </button>
                  )}
                </div>
                {couponError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {couponError}
                  </p>
                )}
                {couponSuccess && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {couponSuccess}
                  </p>
                )}
                {couponData && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-800 space-y-1">
                    <p className="font-semibold">Descuento aplicado</p>
                    <p>Monto original: <span className="line-through">S/ {precioFinalCalculado}</span></p>
                    <p className="font-bold text-green-900">Total a pagar: S/ {precioConDescuento}</p>
                    {couponData.empresa_nombre && (
                      <p className="text-green-600">Convenio: {couponData.empresa_nombre}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
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
            {currentStepId !== 'pago' && (
              <div className="lg:hidden w-full relative mb-6">
                <ReservationSummary
                  steps={steps}
                  stepIndex={stepIndex}
                  paraQuien={paraQuien}
                  perfilUsuario={perfilUsuario}
                  perfilClinicoPropio={perfilClinicoPropio}
                  perfilesDependientes={perfilesDependientes}
                  familiarId={familiarId}
                  modalidad={modalidad}
                  localSeleccionado={localSeleccionado}
                  servicioSeleccionado={servicioSeleccionado}
                  tipoSesion={tipoSesion}
                  paqueteSeleccionado={paqueteSeleccionado}
                  psicologaSeleccionada={psicologaSeleccionada}
                  fechaSeleccionada={fechaSeleccionada}
                  slotSeleccionado={slotSeleccionado}
                  montoEstimado={displayMontoEstimado}
                  isMobile={true}
                  onStepClick={handleStepClick}
                />
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="min-h-[300px]">
                {currentStepId === 'paciente_modalidad_local' && (
                  <StepPatientSelection
                    paraQuien={paraQuien}
                    familiarId={familiarId}
                    modalidad={modalidad}
                    localSeleccionado={localSeleccionado}
                    perfilUsuario={perfilUsuario}
                    perfilClinicoPropio={perfilClinicoPropio}
                    perfilesDependientes={perfilesDependientes}
                    esClinicoIncompletoYo={esClinicoIncompletoYo}
                    esClinicoIncompletoFamiliar={esClinicoIncompletoFamiliar}
                    isPresencialAvailable={isPresencialAvailable}
                    isVirtualAvailable={isVirtualAvailable}
                    locales={sedesConServicios || []}
                    handlePacienteChange={handlePacienteChange}
                    handleModalidadChange={handleModalidadChange}
                    handleLocalChange={handleLocalChange}
                    navigate={navigate}
                  />
                )}
                {currentStepId === 'servicio_psicologo' && (
                  <div className="space-y-3">
                    {/* Switch/Toggle to select search mode */}
                    <div className="flex justify-center w-full max-w-md mx-auto">
                      <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 shadow-inner border border-slate-200/50 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setModoBusqueda('servicio');
                            setServicioSeleccionado(null);
                            setPsicologaSeleccionada(null);
                            setTipoSesion('normal');
                            setPaqueteSeleccionado(null);
                            setFechaSeleccionada(null);
                            setSlotSeleccionado(null);
                            setServicioExpandidoId(null);
                          }}
                          className={`flex-1 px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                            modoBusqueda === 'servicio'
                              ? 'bg-[#003178] text-white shadow-md'
                              : 'bg-transparent text-slate-600 hover:bg-slate-200/55 hover:text-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 justify-center">
                            <span className="material-symbols-outlined text-[16px]">psychology</span>
                            Buscar por Servicio
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModoBusqueda('especialista');
                            setServicioSeleccionado(null);
                            setPsicologaSeleccionada(null);
                            setTipoSesion('normal');
                            setPaqueteSeleccionado(null);
                            setFechaSeleccionada(null);
                            setSlotSeleccionado(null);
                            setServicioExpandidoId(null);
                          }}
                          className={`flex-1 px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                            modoBusqueda === 'especialista'
                              ? 'bg-[#003178] text-white shadow-md'
                              : 'bg-transparent text-slate-600 hover:bg-slate-200/55 hover:text-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 justify-center">
                            <span className="material-symbols-outlined text-[16px]">person</span>
                            Buscar por Especialista
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className={`flex gap-3 items-stretch w-full text-left max-h-[60vh] min-h-[260px] overflow-hidden ${
                      modoBusqueda === 'especialista'
                        ? 'flex-col-reverse md:flex-row-reverse'
                        : 'flex-col md:flex-row'
                    }`}>
                      {/* Left Panel: Services Accordion */}
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm space-y-3 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-sans">
                            {modoBusqueda === 'servicio' ? '1. Elige un Servicio' : '2. Servicios Disponibles'}
                          </h3>
                          {modoBusqueda === 'servicio' && (
                            <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-100">
                              {serviciosFiltrados.length} servicios
                            </span>
                          )}
                        </div>

                        {/* Search Input inside Left Panel */}
                        <div className="relative shrink-0">
                          <input
                            type="text"
                            placeholder="Filtrar servicios..."
                            value={buscarServicio}
                            onChange={(e) => setBuscarServicio(e.target.value)}
                            className="w-full p-2 pl-9 border border-slate-200 bg-white rounded-xl text-xs focus:border-[#003178] outline-none text-gray-700 font-medium shadow-sm"
                          />
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                        </div>

                        {/* Services List */}
                        <div className="space-y-2 overflow-y-auto flex-1 pr-1 h-full">
                          {modoBusqueda === 'especialista' && !psicologaSeleccionada ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center h-full">
                              <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 animate-pulse">face</span>
                              <p className="text-xs font-semibold max-w-[200px] leading-relaxed">
                                Selecciona una especialista a la derecha para ver los servicios que ofrece.
                              </p>
                            </div>
                          ) : serviciosFiltrados.length === 0 ? (
                            <p className="text-xs text-gray-500 bg-white border border-gray-150 rounded-xl p-4 text-center shadow-sm">
                              No hay servicios disponibles para los filtros aplicados.
                            </p>
                          ) : (
                            serviciosFiltrados.map(s => {
                              const isExpanded = servicioExpandidoId === s.id;
                              const isSelected = servicioSeleccionado?.id === s.id;

                              // Dynamic pricing: resolve price before specialist selection
                              const specialistsForService = especialistasElegibles.filter(emp => {
                                if (!emp) return false;
                                const assigned = (dbData.psicologoServicio || []).some(ps =>
                                  ps && ps.psicologo_id === emp.id && ps.servicio_id === s.id
                                );
                                if (!assigned) return false;
                                const hasSchedule = (dbData.horarios || []).some(h =>
                                  h && h.empleado_id === emp.id &&
                                  h.modalidad === modalidad &&
                                  h.disponible &&
                                  h.tipo !== 'salida' && h.tipo !== 'otro' &&
                                  h.local_id === localSeleccionado?.id
                                );
                                return hasSchedule;
                              });
                              const uniqueSpecialist = specialistsForService.length === 1 ? specialistsForService[0] : null;

                              const resolvePrecio = (esp) => obtenerPrecioAplicable({
                                servicio: s,
                                paqueteCatalogo: null,
                                especialista: esp,
                                reglasPrecios: dbData.reglasPrecios,
                                localId: localSeleccionado?.id || null,
                                modalidad: modalidad,
                                asignaciones: dbData.asignaciones,
                                cargos: dbData.cargos
                              });

                              const precioInfo = psicologaSeleccionada
                                ? resolvePrecio(psicologaSeleccionada)
                                : uniqueSpecialist
                                  ? resolvePrecio(uniqueSpecialist)
                                  : resolvePrecio(null);

                              const precioBaseServicio = Number(s.precio_sesion || 0);
                              const tieneReglaPrecio = (dbData.reglasPrecios || []).some(r =>
                                r.servicio_id === s.id && (Number(r.precio || 0) > 0 || Number(r.descuento_porcentaje || 0) > 0)
                              );
                              const tienePrecioIndividual = precioBaseServicio > 0 || tieneReglaPrecio;
                              const precioEsAconsultar = tienePrecioIndividual && !psicologaSeleccionada && !uniqueSpecialist && specialistsForService.length > 1 && tieneReglaPrecio;
                              const estaBloqueado = serviciosBloqueados.has(s.nombre_servicio);

                              return (
                                <div
                                  key={s.id}
                                  className={`border rounded-xl transition-all overflow-hidden ${
                                    isSelected
                                      ? 'border-[#003178] bg-blue-50/10 shadow-sm'
                                      : 'border-slate-200/60 bg-white hover:border-slate-355'
                                  }`}
                                >
                                  {/* Accordion Header */}
                                  <button
                                    type="button"
                                    onClick={() => handleServiceHeaderClick(s)}
                                    className="w-full py-2 px-3 flex justify-between items-center text-left font-sans cursor-pointer focus:outline-none"
                                  >
                                    <div className="flex-1 pr-3">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-[#003178]' : 'text-slate-800'}`}>
                                          {s.nombre_servicio}
                                        </p>
                                        {s.promocion_activa && (() => {
                                          const today = new Date().toISOString().split('T')[0];
                                          const inRange = (!s.promo_fecha_inicio || today >= s.promo_fecha_inicio) && (!s.promo_fecha_fin || today <= s.promo_fecha_fin);
                                          const titulo = s.promocion_titulo || (s.promo_descuento_porcentaje ? `${s.promo_descuento_porcentaje}% OFF` : null);
                                          if (!inRange || !titulo) return null;
                                          return (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">
                                              {titulo}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <p className="text-[9px] text-gray-400 font-semibold mt-0.5">
                                        Duración: {s.duracion_minutos || s.duracion || 60} min
                                      </p>
                                    </div>
                                    <div className="flex items-center shrink-0 gap-0.5">
                                      {estaBloqueado && (
                                        <span className="material-symbols-outlined text-amber-500 text-[16px]">lock</span>
                                      )}
                                      <span className={`material-symbols-outlined text-gray-400 text-[18px] transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#003178]' : ''}`}>
                                        expand_more
                                      </span>
                                    </div>
                                  </button>

                                  {/* Accordion Panel (Formas de reserva) */}
                                  {isExpanded && (() => {
                                    const sPaquetes = (dbData.paquetesCatalogo || []).filter(p => p.servicio_id === s.id).sort((a, b) => {
                                      const numA = parseInt((a.nombre_paquete || '').match(/\d+/)?.[0], 10) || 0;
                                      const numB = parseInt((b.nombre_paquete || '').match(/\d+/)?.[0], 10) || 0;
                                      return numA - numB;
                                    });
                                    const sPaquetesAdquiridos = (activePatientPackages || []).filter(p => p.servicio_id === s.id);
                                    const tieneOpciones = tienePrecioIndividual || (sPaquetesAdquiridos.length > 0) || (sPaquetes.length > 0);
                                    return (
                                      <div className="px-2 pb-2 pt-0.5 border-t border-slate-100 bg-slate-50/50 space-y-1 animate-in slide-in-from-top-1 duration-100">
                                        {estaBloqueado ? (
                                          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                            <p className="text-[10px] font-bold text-amber-800">
                                              Ya cuentas con una sesión pendiente para este servicio. Para agendar la siguiente sesión, debes concluir tu cita anterior.
                                            </p>
                                          </div>
                                        ) : (
                                        <>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                          Forma de Reserva:
                                        </p>
                                        <div className="grid grid-cols-1 gap-1">
                                          {!tieneOpciones ? (
                                            <p className="text-[10px] text-gray-500 text-center py-2.5 bg-white rounded-lg border border-dashed border-gray-200 px-2 font-semibold">
                                              No hay tarifas o paquetes configurados actualmente para este servicio con la especialista seleccionada.
                                            </p>
                                          ) : (
                                            <>
                                              {/* Individual Session Card */}
                                              {tienePrecioIndividual && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setTipoSesion('normal');
                                                    setPaqueteSeleccionado(null);
                                                  }}
                                                  className={`p-2 rounded-xl border-2 text-left flex justify-between items-center transition-all duration-200 cursor-pointer ${
                                                    tipoSesion === 'normal'
                                                      ? 'border-[#003178] bg-blue-50/30'
                                                      : 'border-slate-200/60 bg-white hover:bg-slate-55'
                                                  }`}
                                                >
                                                  <div>
                                                    <p className="text-[11px] font-bold text-slate-800">Sesión Individual</p>
                                                    <p className="text-[9px] text-gray-400 mt-0.5">Paga solo por la sesión programada</p>
                                                  </div>
                                                  <div className="text-right">
                                                    {precioEsAconsultar ? (
                                                      <span className="text-[11px] font-black text-[#003178] font-sans">A consultar</span>
                                                    ) : (
                                                      <>
                                                        {precioInfo.tienePromocion && (
                                                          <span className="text-[9px] text-gray-400 line-through mr-1">
                                                            S/ {precioInfo.precioAntesPromocion}
                                                          </span>
                                                        )}
                                                        <span className="text-[11px] font-black text-[#003178] font-sans">
                                                          S/ {precioInfo.precioFinal}
                                                        </span>
                                                      </>
                                                    )}
                                                  </div>
                                                </button>
                                              )}

                                              {/* Acquired Prepaid Packages */}
                                              {sPaquetesAdquiridos.length > 0 && sPaquetesAdquiridos.map(p => {
                                                const isPackSelected = tipoSesion === 'paquete' && paqueteSeleccionado?.type === 'adquirido' && paqueteSeleccionado?.id === p.id;
                                                return (
                                                  <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                      setTipoSesion('paquete');
                                                      setPaqueteSeleccionado({ ...p, type: 'adquirido' });
                                                    }}
                                                    className={`p-2 rounded-xl border-2 text-left flex justify-between items-center transition-all duration-200 cursor-pointer ${
                                                      isPackSelected
                                                        ? 'border-[#003178] bg-blue-50/30'
                                                        : 'border-slate-200/60 bg-white hover:bg-slate-55'
                                                    }`}
                                                  >
                                                    <div>
                                                      <div className="flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        <p className="text-[11px] font-bold text-slate-800">{p.nombre_paquete_snapshot || 'Paquete Adquirido'}</p>
                                                      </div>
                                                      <p className="text-[9px] text-gray-400 mt-0.5">{p.sesiones_netas} sesiones disponibles</p>
                                                    </div>
                                                    <span className="text-[11px] font-black text-[#003178] font-sans">
                                                      Usar
                                                    </span>
                                                  </button>
                                                );
                                              })}

                                                {/* New Catalog Packages to Buy */}
                                              {sPaquetes.length > 0 && sPaquetes.map(p => {
                                                const isPackSelected = tipoSesion === 'paquete' && paqueteSeleccionado?.type === 'catalogo' && paqueteSeleccionado?.id === p.id;
                                                const packPrecioInfo = obtenerPrecioAplicable({
                                                  servicio: s,
                                                  paqueteCatalogo: p,
                                                  especialista: psicologaSeleccionada || uniqueSpecialist || null,
                                                  reglasPrecios: dbData.reglasPrecios,
                                                  localId: localSeleccionado?.id || null,
                                                  modalidad: modalidad,
                                                  asignaciones: dbData.asignaciones,
                                                  cargos: dbData.cargos
                                                });

                                                return (
                                                  <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                      setTipoSesion('paquete');
                                                      setPaqueteSeleccionado({ ...p, type: 'catalogo' });
                                                    }}
                                                    className={`p-2 rounded-xl border-2 text-left flex justify-between items-center transition-all duration-200 cursor-pointer ${
                                                      isPackSelected
                                                        ? 'border-[#003178] bg-blue-50/30'
                                                        : 'border-slate-200/60 bg-white hover:bg-slate-55'
                                                    }`}
                                                  >
                                                    <div>
                                                      <p className="text-[11px] font-bold text-slate-800">{p.nombre_paquete}</p>
                                                      <p className="text-[9px] text-gray-400 mt-0.5">{p.cantidad_sesiones ?? p.cant_sesiones} sesiones</p>
                                                    </div>
                                                    <div className="text-right">
                                                      {packPrecioInfo.tienePromocion && (
                                                        <span className="text-[9px] text-gray-400 line-through mr-1">
                                                          S/ {packPrecioInfo.precioAntesPromocion}
                                                        </span>
                                                      )}
                                                      <span className="text-[11px] font-black text-[#003178] font-sans">
                                                        S/ {packPrecioInfo.precioFinal}
                                                      </span>
                                                    </div>
                                                  </button>
                                                );
                                              })}
                                            </>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                    );
                                  })()}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Right Panel: Specialists */}
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm space-y-3 flex flex-col h-full min-h-0 overflow-hidden">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-sans">
                            {modoBusqueda === 'servicio' ? '2. Especialistas Compatibles' : '1. Elige una Especialista'}
                          </h3>
                          {modoBusqueda === 'servicio' && servicioSeleccionado && (
                            <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-100">
                              {especialistasConFecha.length} disponibles
                            </span>
                          )}
                        </div>

                        {/* Specialists Cards Container */}
                        <div className="space-y-2 overflow-y-auto flex-1 pr-1 h-full">
                          {modoBusqueda === 'servicio' && !servicioSeleccionado ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center h-full">
                              <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 animate-pulse">psychology</span>
                              <p className="text-xs font-semibold max-w-[200px] leading-relaxed">
                                Selecciona un servicio a la izquierda para ver las especialistas compatibles.
                              </p>
                            </div>
                          ) : especialistasConFecha.length === 0 ? (
                            <p className="text-xs text-gray-500 bg-white border border-gray-150 rounded-xl p-4 text-center shadow-sm">
                              No hay especialistas disponibles con horarios libres en la modalidad seleccionada.
                            </p>
                          ) : (
                            especialistasConFecha.map(p => {
                              const isSelected = psicologaSeleccionada?.id === p.id;
                              const specialty = getEspecialidadEspecialista(p.id);
                              const nextDateStr = p.fechaProx
                                ? new Date(p.fechaProx + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
                                : null;

                              return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleEspecialistaChange(p)}
                                    className={`w-full p-2.5 border rounded-xl text-left flex justify-between items-start transition-all cursor-pointer focus:outline-none ${
                                      isSelected
                                        ? 'border-[#003178] bg-white ring-2 ring-blue-50 shadow-sm'
                                        : 'border-slate-200/60 bg-white hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="space-y-1 flex-1 min-w-0">
                                      <h5 className={`font-bold text-xs font-sans leading-tight ${isSelected ? 'text-[#003178]' : 'text-slate-800'}`}>
                                        {p.nombres_apellidos}
                                      </h5>
                                      <p className="text-[10px] text-slate-500 font-semibold font-sans">
                                        {specialty}
                                      </p>
                                      {nextDateStr && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <span className="material-symbols-outlined text-[12px] text-[#003178]">calendar_today</span>
                                          <span className="text-[9px] font-bold text-[#003178] bg-blue-50/60 border border-blue-100 rounded px-1.5 py-0.5 font-sans whitespace-nowrap">
                                            Prox: {nextDateStr}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <span className="shrink-0 ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-green-50 text-green-700 border border-green-200 uppercase tracking-wide">
                                      Disponible
                                    </span>
                                  </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {currentStepId === 'horario' && renderHorario()}
                {currentStepId === 'pago' && renderPago()}
              </div>

              {/* Navigation Buttons */}
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={stepIndex === 0 || savingAppointment || paymentModalRedirectOnClose}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-55 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          {currentStepId !== 'pago' && (
            <div className="hidden lg:block w-full lg:w-72 xl:w-80 shrink-0 relative">
              <ReservationSummary
                steps={steps}
                stepIndex={stepIndex}
                paraQuien={paraQuien}
                perfilUsuario={perfilUsuario}
                perfilClinicoPropio={perfilClinicoPropio}
                perfilesDependientes={perfilesDependientes}
                familiarId={familiarId}
                modalidad={modalidad}
                localSeleccionado={localSeleccionado}
                servicioSeleccionado={servicioSeleccionado}
                tipoSesion={tipoSesion}
                paqueteSeleccionado={paqueteSeleccionado}
                psicologaSeleccionada={psicologaSeleccionada}
                fechaSeleccionada={fechaSeleccionada}
                slotSeleccionado={slotSeleccionado}
                montoEstimado={displayMontoEstimado}
                isMobile={false}
                onStepClick={handleStepClick}
              />
            </div>
          )}
        </div>
      </div>

      {showCulqiModal && (
        <CulqiModal
          onClose={() => setShowCulqiModal(false)}
          emailDefault={getEmailDefault()}
          concept={servicioSeleccionado?.nombre_servicio}
          price={precioFinalCalculado}
          onPay={saveAppointment}
          navigate={navigate}
        />
      )}

      {/* (Obsolete observations modal has been removed) */}

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
              {(() => {
                const activeTypes = [...new Set(metodosPagoClinica.map(m => m.tipo))];
                if (activeTypes.length <= 1) return null;
                return (
                  <div className="flex gap-2.5 shrink-0">
                    {activeTypes.includes('TRANSFERENCIA') && (
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
                    )}
                    {activeTypes.includes('YAPE') && (
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
                    )}
                    {activeTypes.filter(t => t !== 'TRANSFERENCIA' && t !== 'YAPE').map(tipo => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setMetodoPagoOnlineDetalle(tipo)}
                        className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${metodoPagoOnlineDetalle === tipo
                            ? 'bg-[#003178] border-[#003178] text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                          }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                        {tipo}
                      </button>
                    ))}
                  </div>
                );
              })()}

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

      {/* Segundo Psicólogo (Primer Cambio) */}
      {showFirstChangeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div 
            className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 text-left animate-in zoom-in-95 duration-150 font-sans"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <span className="material-symbols-outlined text-2xl">help_outline</span>
              </div>
              <div>
                <h4 className="font-bold text-base text-gray-900">
                  ¿Deseas continuar con el cambio?
                </h4>
                <p className="text-xs text-gray-550 mt-1 leading-relaxed">
                  Anteriormente habías seleccionado a un especialista diferente ({lastPsychologist ? obtenerNombreCorto(lastPsychologist.psicologa_nombre || lastPsychologist.nombres_apellidos) : 'otro especialista'}). Para cuidar la continuidad de tu terapia, recomendamos seguir con el mismo profesional.
                </p>
              </div>
            </div>
            <div className="w-full flex justify-center items-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowFirstChangeModal(false);
                  if (lastPsychologist) {
                    setPsicologaSeleccionada(lastPsychologist);
                    resetHorariosState();
                  }
                }}
                className="px-6 py-2 h-10 flex items-center justify-center text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer text-center whitespace-nowrap"
              >
                Volver atrás
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFirstChangeModal(false);
                  setPsicologaSeleccionada(tempEspecialista);
                  resetHorariosState();
                }}
                className="px-6 py-2 h-10 flex items-center justify-center bg-[#003178] hover:bg-blue-900 text-white font-medium text-sm rounded-xl transition-all cursor-pointer text-center whitespace-nowrap"
              >
                Confirmar Cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tercer Psicólogo (Segundo Cambio) */}
      {showSecondChangeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div 
            className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 text-left animate-in zoom-in-95 duration-150 font-sans"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h4 className="font-bold text-base text-amber-800">
                  Aviso importante de cambio
                </h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Esta es la última vez que podrás cambiar de psicólogo para este servicio de forma automática. Si decides proceder, tu continuidad terapéutica podría verse afectada.
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Déjanos un comentario del porqué de tu cambio (Opcional)
              </label>
              <textarea
                value={comentarioCambio}
                onChange={e => setComentarioCambio(e.target.value)}
                placeholder="Cuéntanos brevemente la razón de este cambio..."
                rows="3"
                className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:border-[#003178] outline-none resize-none bg-slate-50/50"
              />
            </div>

            <div className="w-full flex justify-center items-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowSecondChangeModal(false);
                  setComentarioCambio('');
                  if (lastPsychologist) {
                    setPsicologaSeleccionada(lastPsychologist);
                    resetHorariosState();
                  }
                }}
                className="px-6 py-2 h-10 flex items-center justify-center text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer text-center whitespace-nowrap"
              >
                Volver atrás
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSecondChangeModal(false);
                  setPsicologaSeleccionada(tempEspecialista);
                  resetHorariosState();
                }}
                className="px-6 py-2 h-10 flex items-center justify-center bg-[#003178] hover:bg-blue-900 text-white font-medium text-sm rounded-xl transition-all cursor-pointer text-center whitespace-nowrap"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bloqueo absoluto — Contactar con Recepción */}
      {showBlockedChangeModal && (
        <div
          onClick={() => {
            setShowBlockedChangeModal(false);
            if (lastPsychologist) {
              setPsicologaSeleccionada(lastPsychologist);
              resetHorariosState();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 text-left animate-in zoom-in-95 duration-150 font-sans"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                <span className="material-symbols-outlined text-2xl">block</span>
              </div>
              <div>
                <h4 className="font-bold text-base text-red-700">
                  Límite de cambios superado
                </h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Has alcanzado el límite máximo de cambios de especialista para este servicio. Para garantizar la continuidad de tu terapia, es necesario que continúes con tu psicólogo actual.
                </p>
                {receptionPhone && (
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                    Si deseas realizar un cambio de especialista, por favor contáctate con Recepción al número: <strong className="text-red-700">{receptionPhone}</strong>.
                  </p>
                )}
                {!receptionPhone && (
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                    Si deseas realizar un cambio de especialista, por favor contáctate con Recepción.
                  </p>
                )}
              </div>
            </div>

            <div className="w-full flex justify-center mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowBlockedChangeModal(false);
                  if (lastPsychologist) {
                    setPsicologaSeleccionada(lastPsychologist);
                    resetHorariosState();
                  }
                }}
                className="px-8 py-2.5 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-xl transition-all cursor-pointer text-center whitespace-nowrap"
              >
                Entendido
              </button>
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
          toast.success('¡Pago procesado exitosamente por Culqi!', { duration: 4000 });
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