import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { obtenerCitasPaciente, cancelarCita } from '../utils/supabaseHelpers';

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

  const handleCancelarCita = async (citaId) => {
    const confirm = window.confirm('¿Estás seguro de que deseas cancelar esta cita?');
    if (!confirm) return;

    try {
      const res = await cancelarCita(citaId);
      if (res.success) {
        alert('Cita cancelada correctamente.');
        setAppointments(prev =>
          prev.map(c => (c.id === citaId ? { ...c, estado_cita: 'Cancelada' } : c))
        );
      } else {
        alert('Error al cancelar la cita: ' + res.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al cancelar la cita.');
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
      list = list.filter(cita => ['Pendiente', 'Confirmada', 'Reprogramada'].includes(cita.estado_cita));
    } else if (activeTab === 'completadas') {
      list = list.filter(cita => ['Realizada', 'Completada'].includes(cita.estado_cita));
    } else if (activeTab === 'canceladas') {
      list = list.filter(cita => ['Cancelada'].includes(cita.estado_cita));
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
  const ESTADOS_ACTIVOS = ['Pendiente', 'Confirmada', 'Reprogramada'];
  const proximaCita = displayAppointments
    .filter(cita => new Date(`${cita.fecha_cita}T${cita.hora_inicio}`) > ahora && ESTADOS_ACTIVOS.includes(cita.estado_cita))
    .sort((a, b) => new Date(`${a.fecha_cita}T${a.hora_inicio}`) - new Date(`${b.fecha_cita}T${b.hora_inicio}`))[0];

  // Función para mostrar el estado de pago con estilos
  const getPaymentBadge = (estado) => {
    const badges = {
      Pendiente: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', dot: 'bg-yellow-500' },
      Pagado: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', dot: 'bg-green-500' },
      'Cobertura especial': { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500' },
    };
    const style = badges[estado] || badges.Pendiente;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${style.bg} ${style.text} border ${style.border} text-xs font-medium`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
        {estado}
      </span>
    );
  };

  const getCitaStateBadge = (estado) => {
    const badges = {
      Pendiente: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
      Confirmada: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
      Realizada: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
      Completada: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
      Cancelada: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
      Reprogramada: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
    };
    const style = badges[estado] || badges.Pendiente;
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border} capitalize`}>
        {estado}
      </span>
    );
  };

  const loading = loadingProfile || loadingCitas;
  const currentError = profileError || error;

  return (
    <DashboardLayout currentPath="/dashboard/appointments" onNavigate={onNavigate}>
      <div className="w-full min-w-0 overflow-x-hidden">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Mis Citas</h2>
            <p className="text-gray-500 text-lg">Gestiona tus próximas sesiones y revisa visitas clínicas pasadas.</p>
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
              {proximaCita ? (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,760px)_260px] gap-6 mb-12 animate-fade-in-up w-full min-w-0 items-stretch">
                  <div className="bg-white text-gray-900 rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between min-w-0">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#003178]">event_upcoming</span>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Próxima Cita</h3>
                      </div>
                      <div>
                        {getCitaStateBadge(proximaCita.estado_cita)}
                      </div>
                    </div>
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
                      <div className="space-y-2.5 min-w-0">
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold">Servicio</p>
                          <p className="text-sm font-bold text-[#003178] break-words whitespace-normal leading-tight">{proximaCita.servicio}</p>
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
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2.5 lg:text-right flex flex-col justify-between items-start lg:items-end min-w-0">
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
                      <div className="col-span-1 lg:col-span-2 pt-3 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 min-w-0">
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
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
                          <button
                            onClick={() => setSelectedCita(proximaCita)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer w-full sm:w-auto text-center whitespace-nowrap"
                          >
                            Ver Detalles
                          </button>
                          {['Pendiente', 'Confirmada', 'Reprogramada'].includes(proximaCita.estado_cita) && (
                            <button
                              onClick={() => handleCancelarCita(proximaCita.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer w-full sm:w-auto text-center whitespace-nowrap"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                    <span className="material-symbols-outlined text-gray-400 mb-3 text-4xl">history</span>
                    <p className="text-4xl font-bold text-gray-900 mb-1">{displayAppointments.length}</p>
                    <h3 className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Sesiones</h3>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500 text-sm mb-12 flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-gray-300 text-4xl mb-2">event_busy</span>
                  <p className="font-semibold text-gray-600">No tienes citas próximas.</p>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up w-full max-w-full">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-gray-50/50 w-full max-w-full">
                  <h3 className="text-xl font-semibold text-gray-900">Historial de Citas</h3>
                  <div className="w-full sm:w-auto overflow-x-auto">
                    <div className="flex gap-2 min-w-max p-1 bg-gray-100/80 rounded-xl border border-gray-200/40">
                      {[
                        { id: 'activas', label: 'Activas' },
                        { id: 'completadas', label: 'Completadas' },
                        { id: 'canceladas', label: 'Canceladas' },
                        { id: 'todas', label: 'Todas' }
                      ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex-shrink-0 whitespace-nowrap ${
                              isActive
                                ? 'bg-white text-[#003178] shadow-sm border border-gray-200/30'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
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
                      <table className="w-full min-w-[760px] text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/30 border-b border-gray-100">
                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Paciente (Miembro)</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Especialista</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Servicio</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado Cita</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado Pago</th>
                            <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredAppointments.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="text-center py-12 text-slate-400 text-sm font-medium">
                                {getEmptyMessage()}
                              </td>
                            </tr>
                          ) : (
                            filteredAppointments.map((cita) => (
                              <tr key={cita.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="py-4 px-6">
                                  <span className="text-gray-900 font-bold text-sm">{cita.paciente_nombre}</span>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-[#003178] flex items-center justify-center text-sm font-bold">
                                      {cita.psicologa_nombre?.charAt(0) || 'E'}
                                    </div>
                                    <span className="text-gray-900 font-medium text-sm">{cita.psicologa_nombre || 'Especialista'}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-gray-600 text-sm">{cita.servicio}</td>
                                <td className="py-4 px-6 text-sm">
                                  <span className="text-gray-900 font-medium">
                                    {new Date(cita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE')}
                                  </span>
                                  <br />
                                  <span className="text-xs text-gray-550 font-semibold">{cita.hora_inicio?.slice(0, 5)} - {cita.hora_fin?.slice(0, 5)}</span>
                                  <br />
                                  <span className="text-[11px] text-[#003178] font-bold capitalize">
                                    {cita.modalidad} {cita.modalidad === 'Virtual' ? '(Virtual)' : ` - ${cita.habitaciones?.locales?.nombre || 'Sede Central'}`}
                                  </span>
                                </td>
                                <td className="py-4 px-6">
                                  {getCitaStateBadge(cita.estado_cita)}
                                </td>
                                <td className="py-4 px-6">{getPaymentBadge(cita.estado_pago)}</td>
                                <td className="py-4 px-6 text-center">
                                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                    <button
                                      onClick={() => setSelectedCita(cita)}
                                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-[#003178] transition-colors cursor-pointer"
                                      title="Ver Detalles"
                                    >
                                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                                    </button>
                                    {['Pendiente', 'Confirmada', 'Reprogramada'].includes(cita.estado_cita) && (
                                      <button
                                        onClick={() => handleCancelarCita(cita.id)}
                                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-650 transition-colors cursor-pointer"
                                        title="Cancelar Cita"
                                      >
                                        <span className="material-symbols-outlined text-[20px]">cancel</span>
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
                              <p className="font-semibold text-gray-800 leading-tight">{cita.servicio}</p>
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
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-semibold">Estado Pago</p>
                              <div className="mt-0.5">{getPaymentBadge(cita.estado_pago)}</div>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-2.5 border-t border-gray-100 gap-3">
                            <span className="text-[10px] text-[#003178] font-bold capitalize leading-tight">
                              {cita.modalidad} {cita.modalidad === 'Virtual' ? '(Virtual)' : ` - ${cita.habitaciones?.locales?.nombre || 'Sede Central'}`}
                            </span>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => setSelectedCita(cita)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial text-center whitespace-nowrap"
                              >
                                Ver Detalles
                              </button>
                              {['Pendiente', 'Confirmada', 'Reprogramada'].includes(cita.estado_cita) && (
                                <button
                                  onClick={() => handleCancelarCita(cita.id)}
                                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 sm:flex-initial text-center whitespace-nowrap"
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
                        <p className="italic text-gray-500">Atención virtual</p>
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
      </div>
    </DashboardLayout>
  );
};

export default Appointments;