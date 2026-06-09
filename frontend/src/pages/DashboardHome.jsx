import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { obtenerCitasPaciente, obtenerDocumentosPaciente } from '../utils/supabaseHelpers';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { loading: loadingProfile, error: profileError, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();
  
  const [appointments, setAppointments] = useState([]);
  const [loadingCitas, setLoadingCitas] = useState(true);
  const [error, setError] = useState('');
  
  const [documentsCount, setDocumentsCount] = useState(0);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    const cargarCitasYDocumentos = async () => {
      if (loadingProfile) return;

      setLoadingCitas(true);
      setLoadingDocs(true);
      setError('');
      try {
        let todasLasCitas = [];
        let totalPendingDocs = 0;

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

          // Cargar documentos
          const docsRes = await obtenerDocumentosPaciente(perfilClinicoPropio.id_paciente);
          if (docsRes.success && docsRes.data) {
            totalPendingDocs += docsRes.data.filter(d => d.estado_pago !== 'Pagado').length;
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

          // Cargar documentos de dependientes
          const docsPromesas = perfilesDependientes.map(dep => obtenerDocumentosPaciente(dep.id_paciente));
          const docsResultados = await Promise.all(docsPromesas);
          docsResultados.forEach(res => {
            if (res.success && res.data) {
              totalPendingDocs += res.data.filter(d => d.estado_pago !== 'Pagado').length;
            }
          });
        }

        // Ordenar por fecha y hora descendente
        todasLasCitas.sort((a, b) => {
          const dateA = new Date(`${a.fecha_cita}T${a.hora_inicio}`);
          const dateB = new Date(`${b.fecha_cita}T${b.hora_inicio}`);
          return dateB - dateA;
        });

        setAppointments(todasLasCitas);
        setDocumentsCount(totalPendingDocs);
      } catch (err) {
        console.error(err);
        setError("Error al cargar los datos del dashboard.");
      } finally {
        setLoadingCitas(false);
        setLoadingDocs(false);
      }
    };

    cargarCitasYDocumentos();
  }, [loadingProfile, perfilClinicoPropio, perfilesDependientes]);

  const ahora = new Date();
  
  const ESTADOS_ACTIVOS = ['Pendiente', 'Confirmada', 'Reprogramada'];

  // Buscar la cita futura más próxima
  const proximaCita = appointments
    .filter(cita => new Date(`${cita.fecha_cita}T${cita.hora_inicio}`) > ahora && ESTADOS_ACTIVOS.includes(cita.estado_cita))
    .sort((a, b) => new Date(`${a.fecha_cita}T${a.hora_inicio}`) - new Date(`${b.fecha_cita}T${b.hora_inicio}`))[0];

  const getCitaStateBadge = (estado) => {
    const badges = {
      Pendiente: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
      Confirmada: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
      Realizada: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
      Cancelada: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
    };
    const style = badges[estado] || badges.Pendiente;
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border} capitalize`}>
        {estado}
      </span>
    );
  };

  const loading = loadingProfile || loadingCitas || loadingDocs;
  const currentError = profileError || error;

  return (
    <DashboardLayout currentPath="/dashboard">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Inicio</h2>
        <p className="text-gray-500 text-lg">Bienvenido a tu portal clínico. Aquí puedes gestionar tu salud emocional.</p>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600 font-bold">Cargando dashboard...</span>
        </div>
      )}

      {currentError && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-8 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500">error</span>
          {currentError}
        </div>
      )}

      {!loading && !currentError && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Welcome Banner */}
          {proximaCita ? (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#003178] to-[#0052a3] p-8 text-white shadow-lg border border-blue-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="space-y-3 z-10 max-w-xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/30 text-blue-100 border border-blue-400/20 text-xs font-semibold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[14px]">event_upcoming</span>
                  Sesión Programada
                </span>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                  Tienes una cita próxima
                </h3>
                <p className="text-blue-100/90 text-sm leading-relaxed font-medium">
                  Con <strong className="text-white font-semibold">{proximaCita.psicologa_nombre}</strong> para el servicio <strong className="text-white font-semibold">{proximaCita.servicio}</strong>.
                </p>
                <div className="flex flex-wrap gap-3 text-xs font-semibold text-blue-100/80 pt-1">
                  <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    {new Date(proximaCita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {proximaCita.hora_inicio?.slice(0, 5)} - {proximaCita.hora_fin?.slice(0, 5)}
                  </span>
                  <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg capitalize">
                    <span className="material-symbols-outlined text-[14px]">{proximaCita.modalidad === 'Virtual' ? 'videocam' : 'storefront'}</span>
                    {proximaCita.modalidad}
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate('/dashboard/book-appointment')}
                className="z-10 bg-white text-[#003178] hover:bg-blue-50 font-semibold px-6 py-3 rounded-xl shadow-md transition-all text-xs tracking-wider shrink-0 cursor-pointer uppercase"
              >
                Agendar nueva cita
              </button>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 p-8 text-white shadow-lg border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="space-y-2 z-10 max-w-xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/30 text-xs font-semibold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[14px]">notifications_paused</span>
                  Sin Citas Pendientes
                </span>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                  Aún no tienes citas próximas
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed font-medium">
                  Toma el control de tu salud mental. Agenda tu próxima sesión clínica con nuestros especialistas.
                </p>
              </div>
              <button
                onClick={() => navigate('/dashboard/book-appointment')}
                className="z-10 bg-[#003178] text-white hover:bg-blue-900 font-semibold px-6 py-3 rounded-xl shadow-md transition-all text-xs tracking-wider shrink-0 cursor-pointer border border-[#003178]/50 uppercase"
              >
                Agendar cita
              </button>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-200">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Próximas Citas</p>
                <p className="text-3xl font-bold text-gray-900">
                  {appointments.filter(cita => new Date(`${cita.fecha_cita}T${cita.hora_inicio}`) > ahora && ESTADOS_ACTIVOS.includes(cita.estado_cita)).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#003178] flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">event_note</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-200">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Documentos</p>
                <p className="text-3xl font-bold text-gray-900">{documentsCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">pending_actions</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-200">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Miembros Registrados</p>
                <p className="text-3xl font-bold text-gray-900">
                  {perfilesDependientes ? perfilesDependientes.length : 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">group</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LADO IZQUIERDO: PRÓXIMAS CITAS LIST & CLINICIANS */}
            <div className="lg:col-span-8 space-y-8">
               {/* Próximas Citas Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h4 className="text-base font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#003178]">calendar_today</span>
                    Próximas Citas
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/30 border-b border-gray-100">
                        <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Paciente</th>
                        <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Servicio / Especialista</th>
                        <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                        <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modalidad</th>
                        <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {appointments.filter(cita => new Date(`${cita.fecha_cita}T${cita.hora_inicio}`) > ahora && ESTADOS_ACTIVOS.includes(cita.estado_cita)).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-12 text-slate-400 text-sm">
                            No tienes citas agendadas próximamente.
                          </td>
                        </tr>
                      ) : (
                        appointments
                          .filter(cita => new Date(`${cita.fecha_cita}T${cita.hora_inicio}`) > ahora && ESTADOS_ACTIVOS.includes(cita.estado_cita))
                          .sort((a, b) => new Date(`${a.fecha_cita}T${a.hora_inicio}`) - new Date(`${b.fecha_cita}T${b.hora_inicio}`))
                          .map((cita) => (
                            <tr key={cita.id} className="hover:bg-gray-50/30 transition-colors">
                              <td className="py-4 px-6">
                                <span className="text-gray-900 font-bold text-sm block">{cita.paciente_nombre}</span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-gray-900 font-semibold text-sm block leading-tight">{cita.servicio}</span>
                                <span className="text-xs text-gray-500 font-medium">{cita.psicologa_nombre}</span>
                              </td>
                              <td className="py-4 px-6 text-sm">
                                <span className="text-gray-900 font-medium">
                                  {new Date(cita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <br />
                                <span className="text-xs text-gray-500 font-semibold">{cita.hora_inicio?.slice(0, 5)} - {cita.hora_fin?.slice(0, 5)}</span>
                              </td>
                              <td className="py-4 px-6 text-sm">
                                <span className="capitalize font-semibold text-gray-700 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px] text-gray-400">{cita.modalidad === 'Virtual' ? 'videocam' : 'storefront'}</span>
                                  {cita.modalidad}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                {getCitaStateBadge(cita.estado_cita)}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Equipo Clínico / Especialistas que has visto */}
              {appointments.length > 0 && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4">
                  <h4 className="text-base font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                    <span className="material-symbols-outlined text-[#003178]">medical_services</span>
                    Especialistas que te han atendido
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(() => {
                      const uniqueSpecs = [];
                      const seenIds = new Set();
                      appointments.forEach(cita => {
                        if (cita.psicologo_id && !seenIds.has(cita.psicologo_id)) {
                          seenIds.add(cita.psicologo_id);
                          uniqueSpecs.push({
                            id: cita.psicologo_id,
                            nombre: cita.psicologa_nombre,
                            servicio: cita.servicio
                          });
                        }
                      });
                      
                      if (uniqueSpecs.length === 0) {
                        return <p className="text-sm text-gray-550 italic col-span-2">Aún no has tenido sesiones con especialistas.</p>;
                      }

                      return uniqueSpecs.map(spec => (
                        <div key={spec.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-[#003178] flex items-center justify-center text-sm font-bold uppercase shadow-sm">
                            {spec.nombre?.charAt(0) || 'E'}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{spec.nombre}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{spec.servicio || 'Psicoterapia'}</p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* LADO DERECHO: ACCIONES RÁPIDAS & HISTORIAL RESUMIDO */}
            <div className="lg:col-span-4 space-y-8">
              {/* Acciones Rápidas */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4">
                <h4 className="text-base font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                  <span className="material-symbols-outlined text-[#003178]">bolt</span>
                  Acciones Rápidas
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => navigate('/dashboard/book-appointment')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left font-semibold text-sm text-gray-700 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[#003178]">calendar_month</span>
                    Agendar Cita
                  </button>
                  <button
                    onClick={() => navigate('/dashboard/profile')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left font-semibold text-sm text-gray-700 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[#003178]">description</span>
                    Ver Historia Clínica
                  </button>
                  <button
                    onClick={() => navigate('/dashboard/family')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left font-semibold text-sm text-gray-700 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[#003178]">groups</span>
                    Ver Miembros
                  </button>
                  <button
                    onClick={() => navigate('/dashboard/documents')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left font-semibold text-sm text-gray-700 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[#003178]">folder_open</span>
                    Ver Documentos
                  </button>
                </div>
              </div>
              
              {/* Historial Resumido */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4">
                <h4 className="text-base font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                  <span className="material-symbols-outlined text-[#003178]">history</span>
                  Historial de Sesiones
                </h4>
                <p className="text-xs text-gray-500 font-semibold">Total de sesiones registradas: {appointments.length}</p>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {appointments.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No hay historial de citas.</p>
                  ) : (
                    appointments.map(cita => (
                      <div key={cita.id} className="flex justify-between items-center p-3 border-b border-gray-100 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-gray-800 leading-tight">{cita.servicio}</p>
                          <p className="text-[10px] text-gray-400 font-semibold">
                            {new Date(cita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} • {cita.hora_inicio?.slice(0, 5)}
                          </p>
                        </div>
                        <div>
                          {getCitaStateBadge(cita.estado_cita)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </DashboardLayout>
  );
};

export default DashboardHome;
