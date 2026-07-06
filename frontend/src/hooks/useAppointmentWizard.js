import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isProfileIncomplete } from '../utils/validators';
import { formatDateStr } from '../utils/appointmentFormatters';
import { crearCita } from '../utils/supabaseHelpers';
import { supabase } from '../supabaseClient';
import { parseTimeToMinutes } from '../utils/schedulerHelper';
import { obtenerPrecioAplicable } from '../utils/pricingHelper';

/**
 * Hook que maneja el estado del wizard de agendamiento:
 * - Navegación entre pasos
 * - Validación por paso
 * - Reinicio de selecciones en cascada
 * - Lógica de guardado de cita
 */
export const useAppointmentWizard = ({
  perfilUsuario,
  perfilClinicoPropio,
  perfilesDependientes,
  dbData,
  availability,
  pricing,
  paymentMethods
}) => {
  const navigate = useNavigate();

  // Wizard state
  const [stepIndex, setStepIndex] = useState(0);
  const [paraQuien, setParaQuien] = useState('yo');
  const [familiarId, setFamiliarId] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [localSeleccionado, setLocalSeleccionado] = useState(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [tipoSesion, setTipoSesion] = useState('normal');
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState(null);
  const [psicologaSeleccionada, setPsicologaSeleccionada] = useState(null);
  const [comentario, setComentario] = useState('');
  const [metodoPago, setMetodoPago] = useState('clinica');

  // Specialist change control
  const [showFirstChangeModal, setShowFirstChangeModal] = useState(false);
  const [showSecondChangeModal, setShowSecondChangeModal] = useState(false);
  const [showBlockedChangeModal, setShowBlockedChangeModal] = useState(false);
  const [tempEspecialista, setTempEspecialista] = useState(null);
  const [lastPsychologist, setLastPsychologist] = useState(null);
  const [comentarioCambio, setComentarioCambio] = useState('');
  const [receptionPhone, setReceptionPhone] = useState('');
  const [cambiosEspecialistaCount, setCambiosEspecialistaCount] = useState(0);

  // Submission state
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalRedirectOnClose, setPaymentModalRedirectOnClose] = useState(false);
  const [showCulqiModal, setShowCulqiModal] = useState(false);

  // Search mode
  const [buscarServicio, setBuscarServicio] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState('servicio');
  const [servicioExpandidoId, setServicioExpandidoId] = useState(null);

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getMonth() !== d.getMonth() || tomorrow.getFullYear() !== d.getFullYear()) {
      return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1);
    }
    return d;
  });

  // Steps definition
  const steps = useMemo(() => [
    { id: 'paciente_modalidad_local', label: 'Paciente' },
    { id: 'servicio_psicologo', label: 'Servicios' },
    { id: 'horario', label: 'Fecha y Horario' },
    { id: 'pago', label: 'Pago' }
  ], []);

  // Profile completeness checks
  const esClinicoIncompletoYo = isProfileIncomplete(perfilClinicoPropio);
  const selectedDependent = perfilesDependientes?.find(d => d.id_paciente === familiarId);
  const esClinicoIncompletoFamiliar = familiarId ? isProfileIncomplete(selectedDependent) : false;

  const currentStepId = steps[stepIndex]?.id;

  const handlePacienteChange = (paraQuienVal, familiarIdVal) => {
    setParaQuien(paraQuienVal);
    setFamiliarId(familiarIdVal);
    setServicioSeleccionado(null);
    setTipoSesion('normal');
    setPaqueteSeleccionado(null);
    setPsicologaSeleccionada(null);
    availability.resetHorariosState();
    setServicioExpandidoId(null);
    setComentarioCambio('');
  };

  const handleModalidadChange = (nuevaMod) => {
    setModalidad(nuevaMod);
    setLocalSeleccionado(null);
    setServicioSeleccionado(null);
    setTipoSesion('normal');
    setPaqueteSeleccionado(null);
    setPsicologaSeleccionada(null);
    availability.resetHorariosState();
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
    setServicioSeleccionado(null);
    setTipoSesion('normal');
    setPaqueteSeleccionado(null);
    setPsicologaSeleccionada(null);
    availability.resetHorariosState();
    setServicioExpandidoId(null);
    setComentarioCambio('');
  };

  const puedesAvanzar = () => {
    const stepId = steps[stepIndex]?.id;
    if (stepId === 'paciente_modalidad_local') {
      const pacienteValid = paraQuien === 'yo'
        ? !esClinicoIncompletoYo
        : (familiarId !== '' && !esClinicoIncompletoFamiliar);
      if (!pacienteValid) return false;
      if (!modalidad) return false;
      if (modalidad === 'Presencial' && !localSeleccionado) return false;
      return true;
    }
    if (stepId === 'servicio_psicologo') {
      if (!servicioSeleccionado) return false;
      if (tipoSesion === 'paquete' && !paqueteSeleccionado) return false;
      return psicologaSeleccionada !== null;
    }
    if (stepId === 'horario') {
      return availability.fechaSeleccionada !== null && availability.slotSeleccionado !== null;
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
            const enabled = availability.cargarFechasHabilitadas(psicologaSeleccionada.id, modalidad, localSeleccionado?.id);
            availability.setFechasHabilitadas(enabled);
          }
          availability.setFechaSeleccionada(null);
          availability.setSlotSeleccionado(null);
          availability.setSlotsDisponibles([]);
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

  const handleStepClick = (stepId) => {
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx !== -1 && idx < stepIndex) {
      setStepIndex(idx);
    }
  };

  const saveAppointment = async (estadoPago, metodoPagoVal) => {
    if (dbData.loading) {
      return { success: false, error: 'Los datos aún se están cargando. Intenta de nuevo en un momento.' };
    }
    setSavingAppointment(true);
    setBookingError('');
    try {
      const pacienteId = paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : familiarId;
      const dateStr = formatDateStr(availability.fechaSeleccionada?.getFullYear(), availability.fechaSeleccionada?.getMonth(), availability.fechaSeleccionada?.getDate());

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

      const priceVal = pricing.couponData ? pricing.precioConDescuento : pricing.precioFinalCalculado;

      let dbHabitacionId = null;
      if (localSeleccionado) {
        const { data: roomsData } = await supabase
          .from('habitaciones')
          .select('*')
          .eq('local_id', localSeleccionado.id)
          .eq('activo', true);
        const localRooms = roomsData || [];

        if (localRooms.length > 0) {
          const { data: allCitasDelDia } = await supabase
            .from('citas')
            .select('hora_inicio, hora_fin, habitacion_id')
            .eq('fecha_cita', dateStr)
            .in('estado_cita', ['Pendiente', 'Confirmado', 'Confirmada', 'Reprogramada', 'En consulta', 'En Consulta']);

          const duracion = servicioSeleccionado?.duracion_minutos || servicioSeleccionado?.duracion || 60;
          const slotStart = parseTimeToMinutes(availability.slotSeleccionado.hora_inicio);
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
        hora_inicio: availability.slotSeleccionado.hora_inicio,
        hora_fin: availability.slotSeleccionado.hora_fin,
        estado_cita: 'Pendiente',
        estado_pago: estadoPago,
        metodo_pago: null,
        tipo_pago: dbMetodoPago,
        monto: priceVal,
        comentario_paciente: comentario,
        paquete_id: dbPaqueteId,
        modalidad: modalidad,
        habitacion_id: dbHabitacionId,
        local_id: localSeleccionado?.id || null,
        comentario_cambio_psicologo: comentarioCambio,
        cupon_id: pricing.couponData ? pricing.couponData.id : null,
        cupon_aplicado: pricing.couponData ? true : false,
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

  const cambiarMes = (incremento) => {
    const nueva = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    nueva.setMonth(nueva.getMonth() + incremento);
    setCalendarMonth(nueva);
  };

  return {
    // Step navigation
    stepIndex, setStepIndex,
    steps,
    currentStepId,
    puedeAvanzar: puedesAvanzar,
    nextStep,
    prevStep,
    handleStepClick,
    cambiarMes,
    calendarMonth,

    // Patient/modality/local
    paraQuien, setParaQuien,
    familiarId, setFamiliarId,
    modalidad, setModalidad,
    localSeleccionado, setLocalSeleccionado,
    esClinicoIncompletoYo,
    esClinicoIncompletoFamiliar,
    handlePacienteChange,
    handleModalidadChange,
    handleLocalChange,

    // Service/specialist
    servicioSeleccionado, setServicioSeleccionado,
    tipoSesion, setTipoSesion,
    paqueteSeleccionado, setPaqueteSeleccionado,
    psicologaSeleccionada, setPsicologaSeleccionada,
    buscarServicio, setBuscarServicio,
    modoBusqueda, setModoBusqueda,
    servicioExpandidoId, setServicioExpandidoId,

    // Specialist change control
    showFirstChangeModal, setShowFirstChangeModal,
    showSecondChangeModal, setShowSecondChangeModal,
    showBlockedChangeModal, setShowBlockedChangeModal,
    tempEspecialista, setTempEspecialista,
    lastPsychologist, setLastPsychologist,
    comentarioCambio, setComentarioCambio,
    receptionPhone, setReceptionPhone,
    cambiosEspecialistaCount, setCambiosEspecialistaCount,

    // Payment
    metodoPago, setMetodoPago,
    showPaymentModal, setShowPaymentModal,
    paymentModalRedirectOnClose, setPaymentModalRedirectOnClose,
    showCulqiModal, setShowCulqiModal,
    savingAppointment,
    bookingError, setBookingError,
    comentario, setComentario,

    // Submission
    saveAppointment,
    handleConfirmarReserva
  };
};
