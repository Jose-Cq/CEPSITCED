import { useState, useEffect } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { obtenerCitasPaciente } from '../utils/supabaseHelpers';

const Appointments = ({ onNavigate }) => {
  const { loading: loadingProfile, error: profileError, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();
  const [appointments, setAppointments] = useState([]);
  const [loadingCitas, setLoadingCitas] = useState(true);
  const [error, setError] = useState('');

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

        // Ordenar por fecha y hora descendente
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

  const ahora = new Date();
  const proximaCita = appointments
    .filter(cita => new Date(`${cita.fecha_cita}T${cita.hora_inicio}`) > ahora)
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
      Cancelada: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
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
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Mis Citas</h2>
        <p className="text-gray-500 text-lg">Gestiona tus próximas sesiones y revisa visitas clínicas pasadas.</p>
      </div>

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
          {/* Tarjeta de próxima cita */}
          {proximaCita && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in-up">
              <div className="md:col-span-2 bg-blue-50 text-gray-900 rounded-xl p-6 border border-blue-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/30 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex items-center gap-2 mb-4 z-10">
                  <span className="material-symbols-outlined text-[#003178]">event_upcoming</span>
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-[#003178]">Próxima Cita</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 z-10">
                  <div>
                    <p className="text-2xl font-bold mb-1">
                      {new Date(proximaCita.fecha_cita + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-gray-600">{proximaCita.hora_inicio?.slice(0, 5)} - {proximaCita.hora_fin?.slice(0, 5)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-semibold">{proximaCita.psicologa_nombre || 'Especialista'}</p>
                    <p className="text-sm text-gray-500 mb-1">{proximaCita.servicio}</p>
                    <p className="text-xs text-[#003178] font-bold mb-3">Paciente: {proximaCita.paciente_nombre}</p>
                    {getCitaStateBadge(proximaCita.estado_cita)}
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                <span className="material-symbols-outlined text-gray-400 mb-3 text-4xl">history</span>
                <p className="text-4xl font-bold text-gray-900 mb-1">{appointments.length}</p>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Sesiones</h3>
              </div>
            </div>
          )}

          {/* Tabla de todas las citas */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Historial de Citas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Paciente (Perfil)</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Especialista</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Servicio</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado Cita</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appointments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-slate-400 text-sm">
                        No tienes citas agendadas aún.
                      </td>
                    </tr>
                  ) : (
                    appointments.map((cita) => (
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
                          <span className="text-xs text-gray-500 font-semibold">{cita.hora_inicio?.slice(0, 5)} - {cita.hora_fin?.slice(0, 5)}</span>
                        </td>
                        <td className="py-4 px-6">
                          {getCitaStateBadge(cita.estado_cita)}
                        </td>
                        <td className="py-4 px-6">{getPaymentBadge(cita.estado_pago)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Appointments;