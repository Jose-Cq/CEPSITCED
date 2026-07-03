import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { obtenerCitasPaciente, cancelarCita, obtenerMetodosPagoClinica } from '../utils/supabaseHelpers';
import { supabase } from '../supabaseClient';
import ConfirmModal from '../components/ConfirmModal';

const Appointments = ({ onNavigate }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const filterMemberId = location.state?.memberId || null;
  const filterMemberName = location.state?.memberName || null;

  const { loading: loadingProfile, error: profileError, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();
  const [appointments, setAppointments] = useState([]);
  const [loadingCitas, setLoadingCitas] = useState(true);
  const [error, setError] = useState('');
  const [selectedCita, setSelectedCita] = useState(null);
  const [activeTab, setActiveTab] = useState('activas');
  const [citaIdParaCancelar, setCitaIdParaCancelar] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [metodosPagoClinica, setMetodosPagoClinica] = useState([]);
  const [loadingMetodosPago, setLoadingMetodosPago] = useState(false);

  const handleCancelarCita = (citaId) => {
    setCitaIdParaCancelar(citaId);
    setShowCancelConfirm(true);
  };

  const confirmarCancelacionCita = async () => {
    if (!citaIdParaCancelar) return;
    const citaId = citaIdParaCancelar;
    setShowCancelConfirm(false);
    setCitaIdParaCancelar(null);

    try {
      const res = await cancelarCita(citaId);
      if (res.success) {
        toast.success('Cita cancelada correctamente.');
        setAppointments(prev =>
          prev.map(c => (c.id === citaId ? { ...c, estado_cita: 'Cancelado', estado_pago: 'Cancelado' } : c))
        );
      } else {
        toast.error('Error al cancelar la cita: ' + res.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al cancelar la cita.');
    }
  };

  useEffect(() => {
    const cargarCitas = async () => {
      if (loadingProfile) return;

      setLoadingCitas(true);
      setError('');
      try {
        let todasLasCitas = [];

        // 1. Cargar las citas del propio perfil (si tiene ficha clínica)
        if (perfilClinicoPropio) {
          const res = await obtenerCitasPaciente(perfilClinicoPropio.id_paciente);
          if (res.success && res.data) {
            const nameYo = `${perfilClinicoPropio.nombres} ${perfilClinicoPropio.apellido_paterno} ${perfilClinicoPropio.apellido_materno || ''}`.trim() + ' (Yo)';
            const citasP = res.data.map(c => ({
              ...c,
              paciente_nombre: nameYo
            }));
            todasLasCitas = [...todasLasCitas, ...citasP];
          }
        }

        // 2. Cargar las citas de los perfiles dependientes
        if (perfilesDependientes && perfilesDependientes.length > 0) {
          const promesas = perfilesDependientes.map(dep => obtenerCitasPaciente(dep.id_paciente));
          const resultados = await Promise.all(promesas);

          resultados.forEach((res, index) => {
            if (res.success && res.data) {
              const dep = perfilesDependientes[index];
              const depFullName = `${dep.nombres} ${dep.apellido_paterno} ${dep.apellido_materno || ''}`.trim();
              const citasDep = res.data.map(c => ({
                ...c,
                paciente_nombre: depFullName
              }));
              todasLasCitas = [...todasLasCitas, ...citasDep];
            }
          });
        }

        // Ordenar por fecha y hora descendente por defecto en la carga
        todasLasCitas.sort((a, b) => {
          const dateA = new Date(`${a.fecha_cita}T${a.hora_inicio}`);
          const dateB = new Date(`${b.fecha_cita}T${b.hora_inicio}`);
          return dateB - dateA;
        });

        setAppointments(todasLasCitas);
      } catch (err) {
        console.error(err);
        setError("Error al cargar el historial de citas.");
      } finally {
        setLoadingCitas(false);
      }
    };

    cargarCitas();
  }, [loadingProfile, perfilClinicoPropio, perfilesDependientes]);

  const displayAppointments = useMemo(() => {
    return filterMemberId
      ? appointments.filter(cita => cita.paciente_id === filterMemberId)
      : appointments;
  }, [appointments, filterMemberId]);

  const filteredAppointments = useMemo(() => {
    let list = displayAppointments;

    if (activeTab === 'activas') {
      list = list.filter(cita => ['Pendiente', 'Confirmada', 'Confirmado', 'Reprogramada', 'En consulta', 'En Consulta'].includes(cita.estado_cita));
    } else if (activeTab === 'completadas') {
      list = list.filter(cita => ['Realizada', 'Completada', 'Atendido', 'Ausente'].includes(cita.estado_cita));
    } else if (activeTab === 'canceladas') {
      list = list.filter(cita => ['Cancelado', 'Cancelada'].includes(cita.estado_cita));
    }

    const sorted = [...list];
    if (activeTab === 'activas') {
      // Las más próximas primero (ascendente)
      sorted.sort((a, b) => {
        const dateA = new Date(`${a.fecha_cita}T${a.hora_inicio}`);
        const dateB = new Date(`${b.fecha_cita}T${b.hora_inicio}`);
        return dateA - dateB;
      });
    } else {
      // Las más recientes primero (descendente)
      sorted.sort((a, b) => {
        const dateA = new Date(`${a.fecha_cita}T${a.hora_inicio}`);
        const dateB = new Date(`${b.fecha_cita}T${b.hora_inicio}`);
        return dateB - dateA;
      });
    }

    return sorted;
  }, [displayAppointments, activeTab]);

  const getEmptyMessage = () => {
    const suffix = filterMemberName ? ` para ${filterMemberName}` : '';
    if (activeTab === 'activas') return `No tienes citas activas${suffix}.`;
    if (activeTab === 'completadas') return `No tienes citas completadas${suffix}.`;
    if (activeTab === 'canceladas') return `No tienes citas canceladas${suffix}.`;
    return `No tienes citas agendadas aún${suffix}.`;
  };

  const ahora = new Date();
  const hoyStr = new Date().toISOString().split('T')[0];
  const ESTADOS_ACTIVOS = ['Pendiente', 'Confirmada', 'Confirmado', 'Reprogramada', 'En consulta', 'En Consulta'];
  const proximaCita = displayAppointments
    .filter(cita => new Date(`${cita.fecha_cita}T${cita.hora_inicio}`) > ahora && ESTADOS_ACTIVOS.includes(cita.estado_cita))
    .sort((a, b) => new Date(`${a.fecha_cita}T${a.hora_inicio}`) - new Date(`${b.fecha_cita}T${b.hora_inicio}`))[0];

  // Función para mostrar el estado de pago con estilos
  const handleOpenPaymentModal = async () => {
    setLoadingMetodosPago(true);
    setShowPaymentModal(true);
    try {
      const res = await obtenerMetodosPagoClinica();
      if (res) setMetodosPagoClinica(res);
    } catch (err) {
      console.error('Error al cargar métodos de pago:', err);
      setMetodosPagoClinica([]);
    } finally {
      setLoadingMetodosPago(false);
    }
  };

  const getPaymentBadge = (estado) => {
    const badges = {
      Pendiente: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
      Pagado: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
      'Cobertura especial': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
      Rechazado: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
      Cancelado: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
      Exonerado: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    };
    const style = badges[estado] || badges.Pendiente;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${style.bg} ${style.text} border ${style.border} text-xs font-medium`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
        {estado}
      </span>
    );
  };

  // Mapeo de estados internos que no deben mostrarse textualmente al paciente
  const ESTADOS_OCULTOS_PACIENTE = {
    'En consulta': 'Confirmado',
    'En Consulta': 'Confirmado',
    'Confirmada': 'Confirmado'
  };

  const getEstadoDisplay = (estado) => {
    return ESTADOS_OCULTOS_PACIENTE[estado] || estado;
  };

  const getCitaStateBadge = (estado) => {
    const displayEstado = getEstadoDisplay(estado);
    const badges = {
      Pendiente: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
      Confirmado: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
      Confirmada: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
      Realizada: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      Completada: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      Atendido: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      Cancelado: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
      Ausente: { bg: 'bg-slate-50', text: 'text-slate-650', border: 'border-slate-200' },
      Reprogramada: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
    };
    const style = badges[displayEstado] || badges.Pendiente;
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border} capitalize`}>
        {displayEstado}
      </span>
    );
  };

  const simplificarNombre = (nombreCompleto) => {
    if (!nombreCompleto) return '';
    let limpio = nombreCompleto.replace(/^(lic|psic|dr|dra|mg|licenciado|doctor|magister)\.?\s+/i, '').trim();
    const esYo = limpio.endsWith(' (Yo)');
    if (esYo) {
      limpio = limpio.replace(' (Yo)', '').trim();
    }
    const partes = limpio.split(/\s+/);
    if (partes.length <= 2) {
      return nombreCompleto;
    }
    const primerNombre = partes[0];
    const apellidoPaterno = partes[partes.length - 2];
    const apellidoMaterno = partes[partes.length - 1];
    const simplificado = `${primerNombre} ${apellidoPaterno} ${apellidoMaterno}`;
    return esYo ? `${simplificado} (Yo)` : simplificado;
  };

  const loading = loadingProfile || loadingCitas;
  const currentError = profileError || error;

  return (
    <DashboardLayout currentPath="/dashboard/appointments" onNavigate={onNavigate}>
      <div className="w-full space-y-6">
        <div className="mb-8 animate-fade-in">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Mis Citas</h2>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            Gestiona tus próximas sesiones y revisa visitas clínicas pasadas.
          </p>
        </div>

          {filterMemberId && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-[#003178] font-medium">
                <span className="material-symbols-outlined">filter_list</span>
                <span>Mostrando citas de: <strong>{filterMemberName}</strong></span>
              </div>
              <button
                onClick={() => navigate('/dashboard/appointments', { state: null })}
                className="text-xs font-bold text-[#003178] hover:underline cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm"
              >
                Limpiar filtro
              </button>
            </div>
          )}

          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-gray-600">Cargando citas...</span>
            </div>
          )}

          {currentError && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-8 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">error</span>
              {currentError}
            </div>
          )}

          {!loading && !currentError && (
            <>
              <div className="mb-12 animate-fade-in-up w-full min-w-0">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6 items-stretch">

                  {proximaCita ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex flex-col min-w-0">
                      <div className="bg-[#003178] px-6 py-3 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-white">event_upcoming</span>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-white">Próxima Cita</h3>
                        </div>
                        <div>
                          {getCitaStateBadge(proximaCita.estado_cita)}
                        </div>
                      </div>
                      <div className="flex-1 p-6 flex flex-col justify-between min-w-0 gap-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-3 min-w-0">
                            <div className="min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Servicio</p>
                              <p className="text-sm font-bold text-[#003178] break-words whitespace-normal leading-tight">{proximaCita.servicio}{proximaCita.numero_sesion ? <span className="ml-1 text-xs font-semibold text-gray-500">— Sesión #{proximaCita.numero_sesion}</span> : ''}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Especialista</p>
                              <p className="text-xs font-bold text-gray-800 break-words whitespace-normal leading-tight">{proximaCita.psicologa_nombre || 'Especialista'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Modalidad</p>
                              <p className="text-xs font-bold text-gray-700 capitalize flex items-center flex-wrap gap-1 mt-0.5 break-words whitespace-normal leading-tight">
                                <span className="material-symbols-outlined text-base text-gray-400">{proximaCita.modalidad === 'Virtual' ? 'videocam' : 'storefront'}</span>
                                {proximaCita.modalidad}
                                {proximaCita.paquete_id && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="material-symbols-outlined text-[11px]">confirmation_number</span>
                                    Prepago
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3 lg:text-right flex flex-col justify-between items-start lg:items-end min-w-0">
                            <div className="w-full min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Fecha y Hora</p>
                              <p className="text-sm font-bold text-gray-900 mt-0.5 break-words whitespace-normal leading-tight">
                                {new Date(proximaCita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                              <p className="text-xs text-gray-550 font-bold mt-0.5 break-words whitespace-normal leading-tight">{proximaCita.hora_inicio?.slice(0, 5)} - {proximaCita.hora_fin?.slice(0, 5)}</p>
                            </div>
                            <div className="w-full min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Paciente</p>
                              <p className="text-xs text-gray-900 font-bold mt-0.5 break-words whitespace-normal leading-tight">{proximaCita.paciente_nombre}</p>
                            </div>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 min-w-0">
                          <div className="text-[11px] text-gray-500 leading-relaxed min-w-0 w-full sm:w-auto break-words whitespace-normal">
                            {proximaCita.modalidad === 'Virtual' ? (
                              <p className="italic">Atención virtual</p>
                            ) : (
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-600 break-words whitespace-normal">Local: <span className="font-normal text-gray-500">{proximaCita.habitaciones?.locales?.nombre || 'Sede Central'}</span></p>
                                <p className="font-semibold text-gray-600 break-words whitespace-normal">Consultorio: <span className="font-normal text-gray-500">{proximaCita.habitaciones?.nombre || 'Consultorio Principal'}</span></p>
                                {proximaCita.habitaciones?.locales?.direccion && (
                                  <p className="font-semibold text-gray-600 break-words whitespace-normal">Dirección: <span className="font-normal text-gray-555">{proximaCita.habitaciones.locales.direccion}</span></p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-row items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedCita(proximaCita)}
                              className="inline-flex items-center justify-center h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Ver Detalles
                            </button>
                            {proximaCita.modalidad === 'Virtual' && (proximaCita.link_reunion && proximaCita.link_reunion.trim() !== '' ? (
                              <a
                                href={proximaCita.link_reunion}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 h-[36px] px-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <span className="material-symbols-outlined text-[16px]">videocam</span>
                                Unirse
                              </a>
                            ) : (
                              <span className="inline-flex items-center justify-center gap-1.5 h-[36px] px-4 bg-gray-100 text-gray-400 font-bold text-xs rounded-lg cursor-not-allowed select-none whitespace-nowrap">
                                <span className="material-symbols-outlined text-[16px]">videocam</span>
                                Pendiente
                              </span>
                            ))}
                            {['Pendiente', 'Confirmada', 'Confirmado', 'Reprogramada', 'En consulta', 'En Consulta'].includes(proximaCita.estado_cita) && (
                              proximaCita.es_titular === false ? (
                                <span className="inline-flex items-center justify-center h-[36px] px-4 bg-gray-100 text-gray-400 border border-gray-200 font-bold text-xs rounded-lg select-none whitespace-nowrap cursor-not-allowed" title="Los acompañantes no pueden cancelar la cita">
                                  Solo lectura
                                </span>
                              ) : (proximaCita.estado_pago === 'Pagado' && proximaCita.metodo_pago !== 'Saldo de Paquete') ? (
                                <span className="inline-flex items-center justify-center h-[36px] px-4 bg-green-50 text-green-800 border border-green-200 font-bold text-xs rounded-lg select-none whitespace-nowrap cursor-not-allowed" title="Cita pagada no se puede cancelar">
                                  Pagado
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleCancelarCita(proximaCita.id)}
                                  className="inline-flex items-center justify-center h-[36px] px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  Cancelar
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-md p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-[200px]">
                      <span className="material-symbols-outlined text-gray-300 text-4xl mb-2">event_busy</span>
                      <p className="font-semibold text-gray-600">No tienes citas próximas.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-md flex flex-col items-center justify-center text-center group cursor-pointer transition-all duration-300 hover:bg-[#003178]">
                      <span className="material-symbols-outlined text-[#003178] group-hover:text-white text-[24px] mb-1 transition-colors duration-300">event_note</span>
                      <p className="text-xl font-bold text-gray-900 group-hover:text-white transition-colors duration-300">
                        {appointments.filter(cita => cita.fecha_cita >= hoyStr && ESTADOS_ACTIVOS.includes(cita.estado_cita)).length}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 group-hover:text-white/80 uppercase tracking-wider mt-0.5 transition-colors duration-300">Próximas</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-md flex flex-col items-center justify-center text-center group cursor-pointer transition-all duration-300 hover:bg-[#003178]">
                      <span className="material-symbols-outlined text-green-600 group-hover:text-white text-[24px] mb-1 transition-colors duration-300">check_circle</span>
                      <p className="text-xl font-bold text-gray-900 group-hover:text-white transition-colors duration-300">
                        {appointments.filter(cita => ['Realizada', 'Completada', 'Atendido'].includes(cita.estado_cita)).length}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 group-hover:text-white/80 uppercase tracking-wider mt-0.5 transition-colors duration-300">Completadas</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-md flex flex-col items-center justify-center text-center group cursor-pointer transition-all duration-300 hover:bg-[#003178]">
                      <span className="material-symbols-outlined text-red-500 group-hover:text-white text-[24px] mb-1 transition-colors duration-300">cancel</span>
                      <p className="text-xl font-bold text-gray-900 group-hover:text-white transition-colors duration-300">
                        {appointments.filter(cita => ['Cancelado', 'Reprogramada'].includes(cita.estado_cita)).length}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500 group-hover:text-white/80 uppercase tracking-wider mt-0.5 transition-colors duration-300">Canceladas / Repro.</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-md flex flex-col items-center justify-center text-center group cursor-pointer transition-all duration-300 hover:bg-[#003178]">
                      <span className="material-symbols-outlined text-purple-600 group-hover:text-white text-[24px] mb-1 transition-colors duration-300">bar_chart</span>
                      <p className="text-xl font-bold text-gray-900 group-hover:text-white transition-colors duration-300">{appointments.length}</p>
                      <p className="text-[10px] font-semibold text-slate-500 group-hover:text-white/80 uppercase tracking-wider mt-0.5 transition-colors duration-300">Total Sesiones</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up w-full max-w-full">
                <div className="p-6 border-b border-[#003366] bg-[#003366] text-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 w-full max-w-full">
                  <h3 className="text-xl font-bold text-white">Historial de Citas</h3>
                  <div className="w-full sm:w-auto overflow-x-auto shrink-0">
                    <div className="flex gap-1.5 min-w-max p-1 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                      {[
                        { id: 'activas', label: 'Pendientes' },
                        { id: 'completadas', label: 'Completadas' },
                        { id: 'canceladas', label: 'Canceladas' },
                        { id: 'todas', label: 'Todas' }
                      ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex-shrink-0 whitespace-nowrap select-none ${
                              isActive
                                ? 'bg-white text-[#003366] shadow-sm font-bold'
                                : 'text-blue-200/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="w-full max-w-full overflow-hidden">
                  <div className="hidden lg:block w-full max-w-full overflow-hidden">
                    <div className="overflow-x-auto max-w-full">
                      <table className="w-full min-w-[800px] text-center border-collapse table-fixed">
                        <thead>
                          <tr className="bg-blue-50 border-b border-blue-100">
                            <th className="py-4 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-center align-middle w-[14%]">Paciente</th>
                            <th className="py-4 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-center align-middle w-[14%]">Especialista</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider text-center align-middle w-[14%]">Servicio</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider text-center align-middle w-[15%]">Fecha y Hora</th>
                            <th className="py-4 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-center align-middle w-[11%]">Estado Cita</th>
                            <th className="text-center w-[4%]"></th>
                            <th className="py-4 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider text-center align-middle w-[11%]">Estado Pago</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-700 uppercase tracking-wider text-center align-middle w-[14%]">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {filteredAppointments.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="text-center py-12 text-slate-400 text-sm font-medium">
                                {getEmptyMessage()}
                              </td>
                            </tr>
                          ) : (
                            filteredAppointments.map((cita) => (
                              <tr key={cita.id} className="bg-white hover:bg-gray-50/50 transition-colors">
                                <td className="py-4 px-3 text-center align-middle w-[14%] text-gray-900 font-bold text-sm whitespace-normal break-words">
                                  {simplificarNombre(cita.paciente_nombre)}
                                </td>
                                <td className="py-4 px-3 text-center align-middle w-[14%] text-gray-900 font-medium text-sm whitespace-normal break-words">
                                  {simplificarNombre(cita.psicologa_nombre) || 'Especialista'}
                                </td>
                                <td className="py-4 px-6 text-center align-middle w-[14%] text-gray-600 text-sm whitespace-normal break-words">
                                  {cita.servicio}{cita.numero_sesion ? <span className="ml-1 text-[11px] text-gray-400 font-semibold">#S{cita.numero_sesion}</span> : ''}
                                </td>
                                <td className="py-4 px-6 text-center align-middle w-[15%] text-sm">
                                  <span className="text-gray-900 font-medium whitespace-normal break-words">
                                    {new Date(cita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE')}
                                  </span>
                                  <div className="mt-1">
                                    <span className="text-xs text-gray-550 font-semibold">{cita.hora_inicio?.slice(0, 5)} - {cita.hora_fin?.slice(0, 5)}</span>
                                  </div>
                                  <div className="mt-1">
                                    <span className="text-[11px] text-[#003178] font-bold capitalize whitespace-normal break-words">
                                      {cita.modalidad === 'Virtual' ? 'Virtual' : `Presencial - ${cita.habitaciones?.locales?.nombre || 'Sede Central'}`}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-3 text-center align-middle w-[11%]">
                                  {getCitaStateBadge(cita.estado_cita)}
                                </td>
                                <td className="py-4 px-3 text-center align-middle w-[4%]">
                                  {cita.estado_pago === 'Pendiente' ? (
                                    <div className="flex justify-center items-center">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenPaymentModal(); }}
                                        className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-lg text-[#003178] hover:bg-blue-50 border border-blue-200 transition-all duration-200 cursor-pointer shrink-0"
                                        title="Ver métodos de pago"
                                      >
                                        <span className="material-symbols-outlined text-[20px] leading-none">credit_card</span>
                                      </button>
                                    </div>
                                  ) : null}
                                </td>
                                <td className="py-4 px-3 text-center align-middle w-[11%]">
                                  {getPaymentBadge(cita.estado_pago)}
                                </td>
                                <td className="py-4 px-6 text-center align-middle w-[14%]">
                                  <div className="flex flex-row items-center justify-center gap-3">
                                    <button
                                      onClick={() => setSelectedCita(cita)}
                                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-[#003178] hover:bg-gray-100 transition-all duration-200 cursor-pointer shrink-0"
                                      title="Ver Detalles"
                                    >
                                      <span className="material-symbols-outlined text-[20px] leading-none">visibility</span>
                                    </button>
                                    {cita.modalidad === 'Virtual' && (cita.link_reunion && cita.link_reunion.trim() !== '' ? (
                                      <a
                                        href={cita.link_reunion}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-green-700 hover:bg-green-100 transition-all duration-200 cursor-pointer shrink-0"
                                        title="Unirse a la sesión virtual"
                                      >
                                        <span className="material-symbols-outlined text-[20px] leading-none">videocam</span>
                                      </a>
                                    ) : (
                                      <span
                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-200 cursor-not-allowed select-none shrink-0"
                                        title="Enlace de reunión pendiente"
                                      >
                                        <span className="material-symbols-outlined text-[20px] leading-none">videocam</span>
                                      </span>
                                    ))}
                                    {cita.es_titular === false ? (
                                      <span
                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-200 cursor-not-allowed select-none shrink-0"
                                        title="Los acompañantes no pueden cancelar la cita"
                                      >
                                        <span className="material-symbols-outlined text-[20px] leading-none text-gray-200">block</span>
                                      </span>
                                    ) : (cita.estado_pago === 'Pagado' && cita.metodo_pago !== 'Saldo de Paquete') ? (
                                      <span
                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-200 cursor-not-allowed select-none shrink-0"
                                        title="Cita pagada no se puede cancelar"
                                      >
                                        <span className="material-symbols-outlined text-[20px] leading-none text-gray-200">cancel</span>
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => ['Pending', 'Pendiente', 'Confirmada', 'Confirmado', 'Reprogramada', 'En consulta', 'En Consulta'].includes(cita.estado_cita) ? handleCancelarCita(cita.id) : null}
                                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 shrink-0 ${
                                          ['Pending', 'Pendiente', 'Confirmada', 'Confirmado', 'Reprogramada', 'En consulta', 'En Consulta'].includes(cita.estado_cita)
                                            ? 'text-gray-555 hover:text-red-650 hover:bg-red-50 cursor-pointer'
                                            : 'text-gray-200 cursor-not-allowed'
                                        }`}
                                        title={['Pending', 'Pendiente', 'Confirmada', 'Confirmado', 'Reprogramada', 'En consulta', 'En Consulta'].includes(cita.estado_cita) ? 'Cancelar Cita' : 'No se puede cancelar'}
                                      >
                                        <span className="material-symbols-outlined text-[20px] leading-none">cancel</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="lg:hidden divide-y divide-gray-100">
                    {filteredAppointments.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-sm font-medium">
                        {getEmptyMessage()}
                      </div>
                    ) : (
                      filteredAppointments.map((cita) => (
                        <div key={cita.id} className="p-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Paciente</p>
                              <p className="text-sm font-bold text-gray-900 leading-tight">{cita.paciente_nombre}</p>
                            </div>
                            <div>
                              {getCitaStateBadge(cita.estado_cita)}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Servicio</p>
                              <p className="font-semibold text-gray-800 leading-tight">{cita.servicio}{cita.numero_sesion ? <span className="ml-1 text-[10px] text-gray-400 font-semibold">#S{cita.numero_sesion}</span> : ''}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Especialista</p>
                              <p className="font-semibold text-gray-800 leading-tight">{cita.psicologa_nombre || 'Especialista'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Fecha y Hora</p>
                              <p className="font-semibold text-gray-800 leading-tight">
                                {new Date(cita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE')}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{cita.hora_inicio?.slice(0, 5)} - {cita.hora_fin?.slice(0, 5)}</p>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">Estado Pago</p>
                                <div className="mt-0.5 flex items-center gap-2">
                                  {getPaymentBadge(cita.estado_pago)}
                                  {cita.estado_pago === 'Pendiente' && (
                                    <button
                                      onClick={() => handleOpenPaymentModal()}
                                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[#003178] hover:bg-blue-50 transition-colors cursor-pointer"
                                      title="Ver métodos de pago"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">credit_card</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-2.5 border-t border-gray-100 gap-3">
                              <span className="text-[10px] text-[#003178] font-bold capitalize leading-tight">
                                {cita.modalidad === 'Virtual' ? 'Virtual' : `Presencial - ${cita.habitaciones?.locales?.nombre || 'Sede Central'}`}
                              </span>
                              <div className="flex gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto sm:justify-end">
                                <button
                                  onClick={() => setSelectedCita(cita)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial text-center whitespace-nowrap"
                                >
                                  Ver Detalles
                                </button>
                                {cita.modalidad === 'Virtual' && (cita.link_reunion && cita.link_reunion.trim() !== '' ? (
                                <a
                                  href={cita.link_reunion}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial text-center whitespace-nowrap"
                                >
                                  <span className="material-symbols-outlined text-[14px]">videocam</span>
                                  Unirse
                                </a>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-400 font-bold text-[11px] rounded-lg cursor-not-allowed select-none flex-1 sm:flex-initial text-center whitespace-nowrap"
                                >
                                  <span className="material-symbols-outlined text-[14px]">videocam</span>
                                  Pendiente
                                </span>
                              ))}
                              {cita.es_titular === false ? (
                                <span
                                  className="bg-gray-50 text-gray-400 border border-gray-150 font-bold text-[11px] px-3 py-1.5 rounded-lg flex-1 sm:flex-initial text-center whitespace-nowrap cursor-not-allowed select-none"
                                  title="Los acompañantes no pueden cancelar la cita"
                                >
                                  Solo lectura
                                </span>
                              ) : (cita.estado_pago === 'Pagado' && cita.metodo_pago !== 'Saldo de Paquete') ? (
                                <span
                                  className="bg-gray-100 text-gray-400 border border-gray-200 font-bold text-[11px] px-3 py-1.5 rounded-lg flex-1 sm:flex-initial text-center whitespace-nowrap cursor-not-allowed select-none animate-fade-in"
                                  title="Cita pagada no se puede cancelar"
                                >
                                  Pagada (No cancelable)
                                </span>
                              ) : (
                                <button
                                  onClick={() => ['Pendiente', 'Confirmada', 'Confirmado', 'Reprogramada', 'En consulta', 'En Consulta'].includes(cita.estado_cita) ? handleCancelarCita(cita.id) : null}
                                  className={`font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors flex-1 sm:flex-initial text-center whitespace-nowrap ${
                                    ['Pendiente', 'Confirmada', 'Confirmado', 'Reprogramada', 'En consulta', 'En Consulta'].includes(cita.estado_cita)
                                      ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer'
                                      : 'bg-gray-55 text-gray-300 border border-gray-100 cursor-not-allowed'
                                  }`}
                                >
                                  Cancelar
                                </button>
                              )}
                              </div>
                            </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {selectedCita && (
            <div 
              onClick={() => setSelectedCita(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-w-md w-full p-6 animate-fade-in-up"
              >
                <header className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Detalles de la Cita</h3>
                  <button onClick={() => setSelectedCita(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </header>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Servicio</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{selectedCita.servicio}</p>
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Estado Cita</p>
                      <p className="mt-1">{getCitaStateBadge(selectedCita.estado_cita)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Estado Pago</p>
                      <p className="mt-1">{getPaymentBadge(selectedCita.estado_pago)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Monto a Pagar</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{selectedCita.monto ? `S/ ${Number(selectedCita.monto).toFixed(2)}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Sesión</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{selectedCita.numero_sesion ? `Sesión #${selectedCita.numero_sesion}` : '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Fecha</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{new Date(selectedCita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Hora</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{selectedCita.hora_inicio?.slice(0, 5)} - {selectedCita.hora_fin?.slice(0, 5)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Modalidad</p>
                      <p className="font-semibold text-gray-700 mt-0.5 capitalize">{selectedCita.modalidad}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Especialista</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{selectedCita.psicologa_nombre || 'Especialista'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Ubicación / Local</p>
                    <div className="text-sm text-gray-800 mt-0.5">
                      {selectedCita.modalidad === 'Virtual' ? (
                        <div className="space-y-2">
                          <p className="italic text-gray-500">Atención virtual</p>
                          {selectedCita.link_reunion && selectedCita.link_reunion.trim() !== '' ? (
                            <a
                              href={selectedCita.link_reunion}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#003178] text-white font-bold text-xs rounded-lg hover:bg-blue-900 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">videocam</span>
                              Unirse a la sesión virtual
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-400 font-bold text-xs rounded-lg cursor-not-allowed select-none">
                              <span className="material-symbols-outlined text-[16px]">videocam</span>
                              Enlace de reunión pendiente
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg space-y-1 mt-1">
                          <p><span className="font-semibold text-gray-600">Local:</span> {selectedCita.habitaciones?.locales?.nombre || 'Sede Central'}</p>
                          <p><span className="font-semibold text-gray-600">Consultorio:</span> {selectedCita.habitaciones?.nombre || 'Consultorio Principal'}</p>
                          {selectedCita.habitaciones?.locales?.direccion && (
                            <p><span className="font-semibold text-gray-600">Dirección:</span> {selectedCita.habitaciones.locales.direccion}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Paciente</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{selectedCita.paciente_nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Cupón Aplicado</p>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      {selectedCita.cupon_aplicado
                        ? `${selectedCita.cupon_aplicado.codigo}${selectedCita.cupon_aplicado.tipo_descuento === 'Porcentaje' ? ` — ${selectedCita.cupon_aplicado.valor_descuento}% de descuento` : ` — S/ ${Number(selectedCita.cupon_aplicado.valor_descuento).toFixed(2)} de descuento`}`
                        : 'Ninguno'}
                    </p>
                  </div>
                  {selectedCita.comentario_paciente && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Comentario del Paciente</p>
                      <p className="text-gray-650 mt-0.5 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">"{selectedCita.comentario_paciente}"</p>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSelectedCita(null)}
                    className="px-4 py-2 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {showPaymentModal && (
        <div
          onClick={() => setShowPaymentModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden max-w-lg w-full p-6 animate-fade-in-up max-h-[90vh] overflow-y-auto"
          >
            <header className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003178">account_balance</span>
                Métodos de Pago
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            {loadingMetodosPago ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : metodosPagoClinica.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No hay métodos de pago configurados.</p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const activeTypes = [...new Set(metodosPagoClinica.map(m => m.tipo))];
                  return activeTypes.map(tipo => {
                    const items = metodosPagoClinica.filter(m => m.tipo === tipo);
                    return items.map((item, idx) => (
                      <div key={`${tipo}-${idx}`} className="p-4 border border-gray-200 rounded-xl bg-slate-50/50 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#003178]">
                            {tipo === 'YAPE' ? 'qr_code' : tipo === 'TRANSFERENCIA' ? 'account_balance' : 'payments'}
                          </span>
                          <h4 className="font-bold text-sm text-gray-800 capitalize">{tipo === 'TRANSFERENCIA' ? 'Transferencia Bancaria' : tipo}</h4>
                        </div>
                        {item.titular && <p className="text-xs text-gray-600"><span className="font-semibold">Titular:</span> {item.titular}</p>}
                        {tipo === 'YAPE' && item.numero_yape && <p className="text-xs text-gray-600"><span className="font-semibold">N° Celular:</span> <span className="font-mono font-bold">{item.numero_yape}</span></p>}
                        {item.banco && <p className="text-xs text-gray-600"><span className="font-semibold">Banco:</span> {item.banco}</p>}
                        {item.numero_cuenta && <p className="text-xs text-gray-600"><span className="font-semibold">N° Cuenta:</span> <span className="font-mono font-bold">{item.numero_cuenta}</span></p>}
                        {item.cci && <p className="text-xs text-gray-600"><span className="font-semibold">CCI:</span> <span className="font-mono font-bold">{item.cci}</span></p>}
                        {item.codigo_qr && (
                          <div className="mt-2">
                            <img src={item.codigo_qr} alt="QR" className="w-32 h-32 object-contain border border-gray-200 rounded-lg" />
                          </div>
                        )}
                      </div>
                    ));
                  });
                })()}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-5 py-2 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Cancelar Cita"
        message="¿Estás seguro de que deseas cancelar esta cita? Esta acción no se puede deshacer."
        confirmText="Sí, cancelar"
        cancelText="No, mantener"
        variant="danger"
        onConfirm={confirmarCancelacionCita}
        onCancel={() => {
          setShowCancelConfirm(false);
          setCitaIdParaCancelar(null);
        }}
      />
    </DashboardLayout>
  );
};

export default Appointments;