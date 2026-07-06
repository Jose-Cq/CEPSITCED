import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { supabase } from '../supabaseClient';
import { formatPhoneNumber } from '../utils/appointmentFormatters';
import { obtenerPrecioAplicable } from '../utils/pricingHelper';

// Hooks
import { useDbCatalog } from '../hooks/useDbCatalog';
import { useAvailability } from '../hooks/useAvailability';
import { useAppointmentPricing } from '../hooks/useAppointmentPricing';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { useAppointmentWizard } from '../hooks/useAppointmentWizard';

// Components
import ReservationSummary from '../components/ReservationSummary';
import StepPatientSelection from '../components/StepPatientSelection';
import StepServiceSpecialist, { obtenerNombreCorto } from '../components/booking/StepServiceSpecialist';
import StepSchedule from '../components/booking/StepSchedule';
import StepPayment from '../components/booking/StepPayment';
import { FirstChangeModal, SecondChangeModal, BlockedChangeModal } from '../components/booking/SpecialistChangeModals';
import PaymentDetailsModal from '../components/booking/PaymentDetailsModal';

const BookAppointment = () => {
  const navigate = useNavigate();
  const { loading: loadingProfile, perfilUsuario, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();
  const dbData = useDbCatalog();

  const availability = useAvailability({ dbData, servicioSeleccionado: null, modalidad: null, localSeleccionado: null });

  const pricing = useAppointmentPricing({
    servicioSeleccionado: null,
    paqueteSeleccionado: null,
    psicologaSeleccionada: null,
    localSeleccionado: null,
    modalidad: null,
    dbData
  });

  const paymentMethods = usePaymentMethods();

  const wizard = useAppointmentWizard({
    perfilUsuario,
    perfilClinicoPropio,
    perfilesDependientes,
    dbData,
    availability,
    pricing,
    paymentMethods
  });

  // Update pricing deps when wizard selections change
  const pricingUpdated = useAppointmentPricing({
    servicioSeleccionado: wizard.servicioSeleccionado,
    paqueteSeleccionado: wizard.paqueteSeleccionado,
    psicologaSeleccionada: wizard.psicologaSeleccionada,
    localSeleccionado: wizard.localSeleccionado,
    modalidad: wizard.modalidad,
    dbData
  });

  // Update availability deps when wizard selections change
  const availabilityUpdated = useAvailability({
    dbData,
    servicioSeleccionado: wizard.servicioSeleccionado,
    modalidad: wizard.modalidad,
    localSeleccionado: wizard.localSeleccionado
  });

  // State for services blocked by existing pending citas
  const [serviciosBloqueados, setServiciosBloqueados] = useState(new Set());

  // Load blocked services
  useEffect(() => {
    const checkBloqueos = async () => {
      const pacienteId = wizard.paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : wizard.familiarId;
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
  }, [wizard.paraQuien, wizard.familiarId, perfilClinicoPropio?.id_paciente, dbData.loading]);

  // Fetch active patient prepaid packages
  const [activePatientPackages, setActivePatientPackages] = useState([]);
  useEffect(() => {
    const cargarPaquetesPaciente = async () => {
      const pacienteId = wizard.paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : wizard.familiarId;
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
  }, [wizard.paraQuien, wizard.familiarId, perfilClinicoPropio]);

  // Set default local
  useEffect(() => {
    const validLocales = (dbData.locales || []).filter(l => l && availabilityUpdated.checkLocalAvailability(l.id, wizard.modalidad || 'Presencial'));
    if (validLocales.length > 0) {
      if (!wizard.localSeleccionado || !validLocales.some(l => l && l.id === wizard.localSeleccionado?.id)) {
        wizard.setLocalSeleccionado(validLocales[0]);
      }
    }
  }, [dbData.locales, dbData.horarios, dbData.citas, dbData.rooms, dbData.servicios, dbData.employees, dbData.psicologoServicio, wizard.modalidad]);

  // Filtering: specialists eligible
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

      if (wizard.modalidad === 'Virtual') {
        if (!wizard.localSeleccionado) return false;
        const tieneBloquesVirtuales = (dbData.horarios || []).some(h =>
          h && h.empleado_id === emp.id &&
          h.modalidad === 'Virtual' &&
          h.local_id === wizard.localSeleccionado.id &&
          h.disponible &&
          h.tipo !== 'salida' &&
          h.tipo !== 'otro'
        );
        if (!tieneBloquesVirtuales) return false;
      }

      return true;
    });
  }, [dbData.employees, dbData.psicologoServicio, dbData.servicios, dbData.horarios, wizard.modalidad, wizard.localSeleccionado]);

  // Filtering: specialists filtered by current service
  const especialistasFiltrados = useMemo(() => {
    if (wizard.modoBusqueda === 'servicio') {
      if (!wizard.servicioSeleccionado) return [];
      return especialistasElegibles.filter(emp => {
        if (!emp) return false;
        const offersService = (dbData.psicologoServicio || []).some(ps =>
          ps && ps.psicologo_id === emp.id && ps.servicio_id === wizard.servicioSeleccionado.id
        );
        if (!offersService) return false;
        return availabilityUpdated.checkSpecialistAvailability(emp, wizard.servicioSeleccionado, wizard.modalidad, wizard.localSeleccionado?.id);
      });
    } else {
      return especialistasElegibles.filter(emp => {
        if (!emp) return false;
        const empServiceIds = (dbData.psicologoServicio || [])
          .filter(ps => ps && ps.psicologo_id === emp.id)
          .map(ps => ps?.servicio_id);
        
        return (dbData.servicios || []).some(s => 
          s && empServiceIds.includes(s.id) &&
          availabilityUpdated.checkSpecialistAvailability(emp, s, wizard.modalidad, wizard.localSeleccionado?.id)
        );
      });
    }
  }, [wizard.modoBusqueda, especialistasElegibles, wizard.servicioSeleccionado, wizard.modalidad, wizard.localSeleccionado, dbData.servicios, dbData.psicologoServicio, dbData.horarios, dbData.citas, dbData.rooms]);

  // Filtering: specialists with nearest date
  const especialistasConFecha = useMemo(() => {
    return especialistasFiltrados.map(emp => {
      if (!emp) return null;
      const fechaProx = availabilityUpdated.calcularFechaMasProxima(emp.id, wizard.modalidad, wizard.localSeleccionado?.id);
      return { ...emp, fechaProx };
    }).filter(emp => emp && emp.fechaProx !== null)
    .sort((a, b) => {
      const getJerarquia = (nombre) => {
        if (!nombre) return 4;
        if (nombre.startsWith('Dra.') || nombre.startsWith('Dr.')) return 1;
        if (nombre.startsWith('Mg.')) return 2;
        if (nombre.startsWith('Lic.')) return 3;
        return 4;
      };
      const rankA = getJerarquia(a.nombres_apellidos);
      const rankB = getJerarquia(b.nombres_apellidos);
      if (rankA !== rankB) return rankA - rankB;
      return (a.nombres_apellidos || '').localeCompare(b.nombres_apellidos || '');
    });
  }, [especialistasFiltrados, wizard.modalidad, wizard.localSeleccionado, dbData.horarios, dbData.citas, dbData.rooms, wizard.servicioSeleccionado, wizard.modoBusqueda]);

  // Sedes con servicios activos
  const sedesConServicios = useMemo(() => {
    return (dbData.locales || []).filter(local =>
      (dbData.servicios || []).some(s =>
        s && s.activo && !s.es_tramite &&
        (s.local_id === local.id || (Array.isArray(s.locales_ids) && s.locales_ids.includes(local.id)))
      )
    );
  }, [dbData.locales, dbData.servicios]);

  // Handlers
  const handleServiceHeaderClick = async (service) => {
    if (!service) return;
    const estaBloqueado = serviciosBloqueados.has(service.nombre_servicio);
    if (wizard.servicioExpandidoId === service.id) {
      wizard.setServicioExpandidoId(null);
      wizard.setServicioSeleccionado(null);
      wizard.setTipoSesion('normal');
      wizard.setPaqueteSeleccionado(null);
      if (wizard.modoBusqueda === 'servicio') {
        wizard.setPsicologaSeleccionada(null);
      }
      availabilityUpdated.setFechaSeleccionada(null);
      availabilityUpdated.setSlotSeleccionado(null);
      wizard.setComentarioCambio('');
    } else if (estaBloqueado) {
      toast.error('Ya cuentas con una sesión pendiente para este servicio. Para agendar la siguiente sesión, debes concluir tu cita anterior.');
    } else {
      wizard.setServicioExpandidoId(service.id);
      wizard.setServicioSeleccionado(service);
      wizard.setComentarioCambio('');
      
      const resolvedPrice = obtenerPrecioAplicable({
        servicio: service,
        paqueteCatalogo: null,
        especialista: wizard.psicologaSeleccionada,
        reglasPrecios: dbData.reglasPrecios,
        localId: wizard.localSeleccionado?.id || null,
        modalidad: wizard.modalidad,
        asignaciones: dbData.asignaciones,
        cargos: dbData.cargos
      }).precioFinal;

      wizard.setTipoSesion(resolvedPrice > 0 ? 'normal' : 'paquete');
      wizard.setPaqueteSeleccionado(null);

      const pacienteId = wizard.paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : wizard.familiarId;
      if (pacienteId && !wizard.psicologaSeleccionada) {
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
                wizard.setPsicologaSeleccionada(matchedEmp);
                wizard.setCambiosEspecialistaCount(0);
              }
            }
          }
        } catch (e) {
          console.error("Error pre-selecting last specialist:", e);
        }
      } else if (wizard.psicologaSeleccionada) {
        const isCompatible = (dbData.psicologoServicio || []).some(ps => 
          ps.psicologo_id === wizard.psicologaSeleccionada.id && ps.servicio_id === service.id
        );
        if (!isCompatible) {
          wizard.setPsicologaSeleccionada(null);
          availabilityUpdated.setFechaSeleccionada(null);
          availabilityUpdated.setSlotSeleccionado(null);
        }
      }
    }
  };

  const handleEspecialistaChange = async (nuevoEspecialista) => {
    try {
      wizard.setBookingError('');
      if (wizard.psicologaSeleccionada?.id === nuevoEspecialista?.id) return;
      if (!nuevoEspecialista) {
        wizard.setPsicologaSeleccionada(null);
        availabilityUpdated.resetHorariosState();
        return;
      }

      const pacienteId = wizard.paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : wizard.familiarId;
      if (!pacienteId || !wizard.servicioSeleccionado) {
        wizard.setPsicologaSeleccionada(nuevoEspecialista);
        availabilityUpdated.resetHorariosState();
        return;
      }

      const { data: history, error } = await supabase
        .from('citas')
        .select('id, psicologo_id, psicologa_nombre, fecha_cita, hora_inicio, estado_cita, estado_pago')
        .eq('paciente_id', pacienteId)
        .eq('servicio', wizard.servicioSeleccionado.nombre_servicio)
        .neq('estado_cita', 'Cancelado')
        .neq('estado_cita', 'Cancelada')
        .order('fecha_cita', { ascending: false })
        .order('hora_inicio', { ascending: false });

      if (error) throw error;

      if (!history || history.length === 0) {
        wizard.setPsicologaSeleccionada(nuevoEspecialista);
        availabilityUpdated.resetHorariosState();
        return;
      }

      const historialValido = history.filter(c =>
        c.estado_cita === 'Atendido' ||
        c.estado_cita === 'Pendiente' ||
        c.estado_pago === 'Pagado'
      );

      if (historialValido.length === 0) {
        wizard.setPsicologaSeleccionada(nuevoEspecialista);
        availabilityUpdated.resetHorariosState();
        return;
      }

      const cleanName = (name) => {
        if (!name || typeof name !== 'string') return "";
        return name.replace(/^(Dra\.|Lic\.|Dr\.|Mg\.|Psic\.)\s*/i, "").trim().toLowerCase();
      };

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
        wizard.setPsicologaSeleccionada(nuevoEspecialista);
        availabilityUpdated.resetHorariosState();
        wizard.setCambiosEspecialistaCount(0);
        return;
      }

      const lastEmp = dbData.employees.find(e => e.id === ultimaCita.psicologo_id) || {
        id: ultimaCita.psicologo_id,
        nombres_apellidos: ultimaCita.psicologa_nombre
      };
      wizard.setLastPsychologist(lastEmp);
      wizard.setTempEspecialista(nuevoEspecialista);

      const totalCambios = cambiosPasados + 1;
      wizard.setCambiosEspecialistaCount(totalCambios);

      const showModal = (fn) => setTimeout(() => fn(), 0);

      if (totalCambios >= 3) {
        showModal(() => {
          wizard.setShowBlockedChangeModal(true);
        });
      } else if (totalCambios === 2) {
        showModal(() => wizard.setShowSecondChangeModal(true));
      } else {
        showModal(() => wizard.setShowFirstChangeModal(true));
      }
    } catch (err) {
      console.error('Error al verificar historial de cambios:', err);
      wizard.setPsicologaSeleccionada(nuevoEspecialista);
      availabilityUpdated.resetHorariosState();
    }
  };

  const handleModoBusquedaChange = (nuevoModo) => {
    wizard.setModoBusqueda(nuevoModo);
    wizard.setServicioSeleccionado(null);
    wizard.setPsicologaSeleccionada(null);
    wizard.setTipoSesion('normal');
    wizard.setPaqueteSeleccionado(null);
    availabilityUpdated.setFechaSeleccionada(null);
    availabilityUpdated.setSlotSeleccionado(null);
    wizard.setServicioExpandidoId(null);
  };

  const handleServiceSelect = (tipo, paquete) => {
    wizard.setTipoSesion(tipo);
    wizard.setPaqueteSeleccionado(paquete);
  };

  const handlePackageSelect = (paquete) => {
    wizard.setTipoSesion('paquete');
    wizard.setPaqueteSeleccionado(paquete);
  };

  const handleApplyCoupon = async (couponCode, setCouponLoading, setCouponError, setCouponSuccess) => {
    setCouponError('');
    setCouponSuccess('');
    pricingUpdated.setCouponData(null);
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
      if (coupon.servicio_id && coupon.servicio_id !== wizard.servicioSeleccionado?.id) {
        setCouponError('Este cupón no aplica para el servicio seleccionado.');
        return;
      }
      if (coupon.paquete_catalogo_id && coupon.paquete_catalogo_id !== wizard.paqueteSeleccionado?.id) {
        setCouponError('Este cupón no aplica para el paquete seleccionado.');
        return;
      }

      const pacienteId = wizard.paraQuien === 'yo' ? perfilClinicoPropio?.id_paciente : wizard.familiarId;
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

      pricingUpdated.setCouponData(coupon);
      let descText = '';
      if (coupon.tipo_descuento === 'Porcentaje') {
        descText = `${coupon.valor_descuento}% de descuento`;
      } else if (coupon.tipo_descuento === 'Monto') {
        descText = `S/ ${coupon.valor_descuento} de descuento`;
      }
      setCouponSuccess(`Cupón aplicado: ${descText}`);
      return { success: true };
    } catch (err) {
      setCouponError(err.message || 'Error al validar el cupón.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    pricingUpdated.setCouponData(null);
  };

  // Stepper
  const renderStepIndicator = () => {
    return (
      <div className="mb-10">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          {wizard.steps.map((s, idx) => {
            const isCompleted = wizard.stepIndex > idx;
            const isActive = wizard.stepIndex === idx;
            return (
              <div key={s.id} className="flex items-center relative flex-1">
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
                {idx < wizard.steps.length - 1 && (
                  <div className={`h-[2px] flex-1 transition-all ${
                    wizard.stepIndex > idx ? 'bg-[#003178]' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="h-6" />
      </div>
    );
  };

  // Loading state
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

        {renderStepIndicator()}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0 w-full">
            {/* Mobile Summary */}
            {wizard.currentStepId !== 'pago' && (
              <div className="lg:hidden w-full relative mb-6">
                <ReservationSummary
                  steps={wizard.steps}
                  stepIndex={wizard.stepIndex}
                  paraQuien={wizard.paraQuien}
                  perfilUsuario={perfilUsuario}
                  perfilClinicoPropio={perfilClinicoPropio}
                  perfilesDependientes={perfilesDependientes}
                  familiarId={wizard.familiarId}
                  modalidad={wizard.modalidad}
                  localSeleccionado={wizard.localSeleccionado}
                  servicioSeleccionado={wizard.servicioSeleccionado}
                  tipoSesion={wizard.tipoSesion}
                  paqueteSeleccionado={wizard.paqueteSeleccionado}
                  psicologaSeleccionada={wizard.psicologaSeleccionada}
                  fechaSeleccionada={availabilityUpdated.fechaSeleccionada}
                  slotSeleccionado={availabilityUpdated.slotSeleccionado}
                  montoEstimado={pricingUpdated.displayMontoEstimado}
                  isMobile={true}
                  onStepClick={wizard.handleStepClick}
                />
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="min-h-[300px]">
                {wizard.currentStepId === 'paciente_modalidad_local' && (
                  <StepPatientSelection
                    paraQuien={wizard.paraQuien}
                    familiarId={wizard.familiarId}
                    modalidad={wizard.modalidad}
                    localSeleccionado={wizard.localSeleccionado}
                    perfilUsuario={perfilUsuario}
                    perfilClinicoPropio={perfilClinicoPropio}
                    perfilesDependientes={perfilesDependientes}
                    esClinicoIncompletoYo={wizard.esClinicoIncompletoYo}
                    esClinicoIncompletoFamiliar={wizard.esClinicoIncompletoFamiliar}
                    isPresencialAvailable={availabilityUpdated.isPresencialAvailable}
                    isVirtualAvailable={availabilityUpdated.isVirtualAvailable}
                    locales={sedesConServicios || []}
                    handlePacienteChange={wizard.handlePacienteChange}
                    handleModalidadChange={wizard.handleModalidadChange}
                    handleLocalChange={wizard.handleLocalChange}
                    navigate={navigate}
                  />
                )}
                {wizard.currentStepId === 'servicio_psicologo' && (
                  <StepServiceSpecialist
                    dbData={dbData}
                    modalidad={wizard.modalidad}
                    localSeleccionado={wizard.localSeleccionado}
                    modoBusqueda={wizard.modoBusqueda}
                    setModoBusqueda={wizard.setModoBusqueda}
                    buscarServicio={wizard.buscarServicio}
                    setBuscarServicio={wizard.setBuscarServicio}
                    servicioSeleccionado={wizard.servicioSeleccionado}
                    setServicioSeleccionado={wizard.setServicioSeleccionado}
                    psicologaSeleccionada={wizard.psicologaSeleccionada}
                    setPsicologaSeleccionada={wizard.setPsicologaSeleccionada}
                    tipoSesion={wizard.tipoSesion}
                    setTipoSesion={wizard.setTipoSesion}
                    paqueteSeleccionado={wizard.paqueteSeleccionado}
                    setPaqueteSeleccionado={wizard.setPaqueteSeleccionado}
                    servicioExpandidoId={wizard.servicioExpandidoId}
                    setServicioExpandidoId={wizard.setServicioExpandidoId}
                    serviciosBloqueados={serviciosBloqueados}
                    activePatientPackages={activePatientPackages}
                    especialistasElegibles={especialistasElegibles}
                    especialistasConFecha={especialistasConFecha}
                    onServiceHeaderClick={handleServiceHeaderClick}
                    onEspecialistaChange={handleEspecialistaChange}
                    onModoBusquedaChange={handleModoBusquedaChange}
                    onServiceSelect={handleServiceSelect}
                    onPackageSelect={handlePackageSelect}
                  />
                )}
                {wizard.currentStepId === 'horario' && (
                  <StepSchedule
                    calendarMonth={wizard.calendarMonth}
                    fechasHabilitadas={availabilityUpdated.fechasHabilitadas}
                    fechaSeleccionada={availabilityUpdated.fechaSeleccionada}
                    setFechaSeleccionada={availabilityUpdated.setFechaSeleccionada}
                    slotsDisponibles={availabilityUpdated.slotsDisponibles}
                    slotSeleccionado={availabilityUpdated.slotSeleccionado}
                    setSlotSeleccionado={availabilityUpdated.setSlotSeleccionado}
                    psicologaSeleccionada={wizard.psicologaSeleccionada}
                    modalidad={wizard.modalidad}
                    localSeleccionado={wizard.localSeleccionado}
                    cargarSlotsDelDia={availabilityUpdated.cargarSlotsDelDia}
                    cambiarMes={wizard.cambiarMes}
                  />
                )}
                {wizard.currentStepId === 'pago' && (
                  <StepPayment
                    paraQuien={wizard.paraQuien}
                    perfilUsuario={perfilUsuario}
                    perfilClinicoPropio={perfilClinicoPropio}
                    perfilesDependientes={perfilesDependientes}
                    familiarId={wizard.familiarId}
                    psicologaSeleccionada={wizard.psicologaSeleccionada}
                    servicioSeleccionado={wizard.servicioSeleccionado}
                    modalidad={wizard.modalidad}
                    localSeleccionado={wizard.localSeleccionado}
                    fechaSeleccionada={availabilityUpdated.fechaSeleccionada}
                    slotSeleccionado={availabilityUpdated.slotSeleccionado}
                    comentario={wizard.comentario}
                    paqueteSeleccionado={wizard.paqueteSeleccionado}
                    metodoPago={wizard.metodoPago}
                    setMetodoPago={wizard.setMetodoPago}
                    precioFinalCalculado={pricingUpdated.precioFinalCalculado}
                    precioConDescuento={pricingUpdated.precioConDescuento}
                    couponData={pricingUpdated.couponData}
                    onShowPaymentModal={() => wizard.setShowPaymentModal(true)}
                    bookingError={wizard.bookingError}
                    onApplyCoupon={handleApplyCoupon}
                    onRemoveCoupon={handleRemoveCoupon}
                  />
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between">
                <button
                  type="button"
                  onClick={wizard.prevStep}
                  disabled={wizard.stepIndex === 0 || wizard.savingAppointment || wizard.paymentModalRedirectOnClose}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-55 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Atrás
                </button>

                {wizard.stepIndex < wizard.steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={wizard.nextStep}
                    disabled={!wizard.puedeAvanzar()}
                    className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {wizard.steps[wizard.stepIndex]?.id === 'horario' ? 'Continuar al Pago' : 'Siguiente'}
                  </button>
                ) : wizard.paymentModalRedirectOnClose ? (
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
                    onClick={wizard.handleConfirmarReserva}
                    disabled={wizard.savingAppointment}
                    className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-sans"
                  >
                    {wizard.savingAppointment ? 'Guardando Cita...' : 'Confirmar y Agendar'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Summary Sidebar */}
          {wizard.currentStepId !== 'pago' && (
            <div className="hidden lg:block w-full lg:w-72 xl:w-80 shrink-0 relative">
              <ReservationSummary
                steps={wizard.steps}
                stepIndex={wizard.stepIndex}
                paraQuien={wizard.paraQuien}
                perfilUsuario={perfilUsuario}
                perfilClinicoPropio={perfilClinicoPropio}
                perfilesDependientes={perfilesDependientes}
                familiarId={wizard.familiarId}
                modalidad={wizard.modalidad}
                localSeleccionado={wizard.localSeleccionado}
                servicioSeleccionado={wizard.servicioSeleccionado}
                tipoSesion={wizard.tipoSesion}
                paqueteSeleccionado={wizard.paqueteSeleccionado}
                psicologaSeleccionada={wizard.psicologaSeleccionada}
                fechaSeleccionada={availabilityUpdated.fechaSeleccionada}
                slotSeleccionado={availabilityUpdated.slotSeleccionado}
                montoEstimado={pricingUpdated.displayMontoEstimado}
                isMobile={false}
                onStepClick={wizard.handleStepClick}
              />
            </div>
          )}
        </div>
      </div>

      {/* Specialist Change Modals */}
      <FirstChangeModal
        show={wizard.showFirstChangeModal}
        onClose={() => {
          wizard.setShowFirstChangeModal(false);
          if (wizard.lastPsychologist) {
            wizard.setPsicologaSeleccionada(wizard.lastPsychologist);
            availabilityUpdated.resetHorariosState();
          }
        }}
        onConfirm={() => {
          wizard.setShowFirstChangeModal(false);
          wizard.setPsicologaSeleccionada(wizard.tempEspecialista);
          availabilityUpdated.resetHorariosState();
        }}
        lastPsychologist={wizard.lastPsychologist}
      />

      <SecondChangeModal
        show={wizard.showSecondChangeModal}
        onClose={() => {
          wizard.setShowSecondChangeModal(false);
          wizard.setComentarioCambio('');
          if (wizard.lastPsychologist) {
            wizard.setPsicologaSeleccionada(wizard.lastPsychologist);
            availabilityUpdated.resetHorariosState();
          }
        }}
        onConfirm={() => {
          wizard.setShowSecondChangeModal(false);
          wizard.setPsicologaSeleccionada(wizard.tempEspecialista);
          availabilityUpdated.resetHorariosState();
        }}
        comentarioCambio={wizard.comentarioCambio}
        setComentarioCambio={wizard.setComentarioCambio}
      />

      <BlockedChangeModal
        show={wizard.showBlockedChangeModal}
        onClose={() => {
          wizard.setShowBlockedChangeModal(false);
          if (wizard.lastPsychologist) {
            wizard.setPsicologaSeleccionada(wizard.lastPsychologist);
            availabilityUpdated.resetHorariosState();
          }
        }}
        receptionPhone={wizard.receptionPhone}
      />

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        show={wizard.showPaymentModal}
        onClose={() => wizard.setShowPaymentModal(false)}
        metodosPagoClinica={paymentMethods.metodosPagoClinica}
        loadingMetodosPago={paymentMethods.loadingMetodosPago}
        metodoPagoOnlineDetalle={paymentMethods.metodoPagoOnlineDetalle}
        setMetodoPagoOnlineDetalle={paymentMethods.setMetodoPagoOnlineDetalle}
        onNavigateAfterClose={() => navigate('/dashboard/appointments')}
        paymentModalRedirectOnClose={wizard.paymentModalRedirectOnClose}
      />
    </DashboardLayout>
  );
};

export default BookAppointment;
