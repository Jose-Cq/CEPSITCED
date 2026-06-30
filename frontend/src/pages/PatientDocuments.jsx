import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { obtenerDocumentosPaciente } from '../utils/supabaseHelpers';

const PatientDocuments = ({ onNavigate }) => {
  const { loading: loadingProfile, error: profileError, perfilClinicoPropio } = usePacienteActual();
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState('');
  const [currentPdfTitle, setCurrentPdfTitle] = useState('');

  useEffect(() => {
    const cargarDocumentos = async () => {
      if (loadingProfile) return;

      // Si no hay perfil clínico propio aún
      if (!perfilClinicoPropio) {
        setLoadingDocs(false);
        return;
      }

      setLoadingDocs(true);
      setError('');
      try {
        // Obtenemos solo los documentos del paciente actual logueado
        const res = await obtenerDocumentosPaciente(perfilClinicoPropio.id_paciente);
        if (res.success && res.data) {
          // Filtrado de seguridad adicional en el frontend
          const filteredDocs = res.data.filter(d => d.habilitar_visualizacion === true);
          setDocuments(filteredDocs);
        } else {
          throw new Error(res.error || 'Error al obtener documentos');
        }
      } catch (err) {
        console.error('Error al cargar documentos del paciente:', err);
        setError('No se pudieron cargar tus documentos. Inténtalo de nuevo más tarde.');
        toast.error('Error al cargar documentos');
      } finally {
        setLoadingDocs(false);
      }
    };

    cargarDocumentos();
  }, [loadingProfile, perfilClinicoPropio]);

  const handleViewPdf = (doc) => {
    if (!doc.archivo_pdf) {
      toast.warning("No hay archivo disponible para visualizar.");
      return;
    }
    setCurrentPdfUrl(doc.archivo_pdf);
    setCurrentPdfTitle(doc.tipo_documento || 'Documento');
    setPdfModalOpen(true);
  };

  const handleDownloadDirect = (doc) => {
    const base64Data = doc.archivo_pdf;
    if (!base64Data) {
      toast.warning("Archivo no disponible.");
      return;
    }
    
    toast.success(`Descargando ${doc.tipo_documento || 'Documento'}...`);
    const link = document.createElement("a");
    link.href = base64Data;
    link.download = `${(doc.tipo_documento || 'documento').replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loading = loadingProfile || loadingDocs;
  const currentError = profileError || error;

  // Formateador de fecha es-PE
  const formatearFecha = (fechaString) => {
    if (!fechaString) return '-';
    try {
      const date = new Date(fechaString);
      return date.toLocaleDateString('es-PE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return fechaString;
    }
  };

  const obtenerEspecialidad = (doc) => {
    if (!doc.empleados) return 'Psicología';
    const asignaciones = doc.empleados.asignaciones_empleado || [];
    const nombresAreas = asignaciones
      .map(a => a.areas?.nombre)
      .filter(Boolean);
    const areasUnicas = [...new Set(nombresAreas)];
    if (areasUnicas.length === 0) {
      return 'Psicología';
    }
    const areasLimpias = areasUnicas.map(a => a.replace(/^Psicología\s+/i, ''));
    return `Psicología ${areasLimpias.join(' / ')}`;
  };

  return (
    <DashboardLayout currentPath="/dashboard/documents" onNavigate={onNavigate}>
      <div className="w-full space-y-6 animate-fade-in font-['Manrope']">
        {/* Encabezado */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
            Mis Documentos y Trámites
          </h2>
          <p className="text-slate-500 text-sm md:text-base max-w-2xl leading-relaxed">
            Visualiza y descarga los certificados, informes clínicos y trámites que tus psicólogos han compartido contigo.
          </p>
        </div>

        {/* Alerta de Seguridad / Informativo */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#003178]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#003178] font-bold">verified_user</span>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-[#003178]">Espacio Seguro de Trámites</h4>
            <p className="text-slate-600 text-xs md:text-sm leading-relaxed">
              Todos tus documentos son estrictamente confidenciales. Solo se visualizan los informes finales autorizados por el especialista y listos para descarga.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 space-y-3">
            <div className="w-12 h-12 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-500 text-sm font-semibold">Cargando tus documentos...</span>
          </div>
        ) : currentError ? (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-5 flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-500 text-2xl">error</span>
            <div className="text-sm font-medium">{currentError}</div>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm max-w-lg mx-auto mt-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
              <span className="material-symbols-outlined text-3xl">folder_open</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Sin documentos disponibles</h3>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-6">
              Aún no tienes trámites o informes habilitados para visualización directa. Si esperas un documento, comunícate con tu especialista.
            </p>
          </div>
        ) : (
          /* Contenedor de la tabla moderna / responsive */
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-[#003178] text-white">
                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-center align-middle">
                      Paciente
                    </th>
                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-center align-middle">
                      Especialista
                    </th>
                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-center align-middle">
                      Servicio/Detalle
                    </th>
                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-center align-middle">
                      Fecha de Registro
                    </th>
                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-center align-middle">
                      Estado de Pago
                    </th>
                    <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-center align-middle">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => {
                    const isPaid = doc.estado_pago === 'Pagado';
                    const hasPdf = !!doc.archivo_pdf;

                    // Formatear nombre del paciente
                    const pacienteNombre = doc.pacientes
                      ? `${doc.pacientes.nombres || ''} ${doc.pacientes.apellido_paterno || ''} ${doc.pacientes.apellido_materno || ''}`.trim()
                      : 'Paciente';

                    // Formatear nombre del especialista
                    const especialistaNombre = doc.empleados
                      ? `${doc.empleados.nombres || ''} ${doc.empleados.apellido_paterno || ''} ${doc.empleados.apellido_materno || ''}`.trim()
                      : 'Centro CEPSITCED';

                    // Detalle del servicio
                    const servicioDetalle = doc.servicios
                      ? doc.servicios.nombre_servicio
                      : (doc.tipo_documento || 'Trámite Documental');

                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                        {/* Paciente */}
                        <td className="py-4 px-6 text-center align-middle text-sm font-semibold text-slate-800">
                          {pacienteNombre}
                        </td>

                        {/* Especialista */}
                        <td className="py-4 px-6 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-sm font-semibold text-slate-800">
                              {especialistaNombre}
                            </span>
                            <span className="text-xs text-slate-400 font-normal mt-0.5">
                              {obtenerEspecialidad(doc)}
                            </span>
                          </div>
                        </td>

                        {/* Servicio/Detalle */}
                        <td className="py-4 px-6 text-center align-middle">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-sm font-semibold text-slate-800">
                              {servicioDetalle}
                            </span>
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-100">
                              {doc.tipo_documento || 'Informe'}
                            </span>
                          </div>
                        </td>

                        {/* Fecha de Registro */}
                        <td className="py-4 px-6 text-center align-middle text-sm text-slate-600 font-medium">
                          {formatearFecha(doc.created_at)}
                        </td>

                        {/* Estado de Pago */}
                        <td className="py-4 px-6 text-center align-middle">
                          <div className="flex items-center justify-center">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <span className="material-symbols-outlined text-[14px] font-bold">check_circle</span>
                                Pagado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                <span className="material-symbols-outlined text-[14px]">error</span>
                                Pendiente
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Acción */}
                        <td className="py-4 px-6 text-center align-middle">
                          <div className="flex items-center justify-center gap-2">
                            {hasPdf && (
                              <button
                                onClick={() => handleViewPdf(doc)}
                                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium text-xs transition-all shadow-sm cursor-pointer select-none"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye shrink-0">
                                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                                Ver
                              </button>
                            )}
                            {hasPdf ? (
                              <button
                                onClick={() => handleDownloadDirect(doc)}
                                className="inline-flex items-center gap-1.5 bg-[#003178] hover:bg-blue-900 text-white transition-all px-3 h-9 rounded-lg text-xs font-medium shadow-sm cursor-pointer select-none"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download shrink-0">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/>
                                  <line x1="12" x2="12" y1="15" y2="3"/>
                                </svg>
                                Descargar
                              </button>
                            ) : (
                              <button
                                disabled
                                className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-100 text-slate-400 px-3 h-9 rounded-lg text-xs font-medium cursor-not-allowed select-none"
                                title="Archivo PDF en proceso de carga"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw animate-spin shrink-0">
                                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.72 2.78L21 8"/>
                                  <polyline points="21 3 21 8 16 8"/>
                                </svg>
                                En Proceso
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal de Visualización de PDF */}
        {pdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-150 font-sans border border-slate-100">
              {/* Header del modal */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      picture_as_pdf
                    </span>
                  </div>
                  <h4 className="font-bold text-base text-slate-800">
                    {currentPdfTitle || 'Visualizar Documento'}
                  </h4>
                </div>
                <button
                  onClick={() => {
                    setPdfModalOpen(false);
                    setCurrentPdfUrl('');
                    setCurrentPdfTitle('');
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>

              {/* Contenido / iframe */}
              <div className="flex-1 bg-slate-100 p-2 flex items-center justify-center">
                {currentPdfUrl ? (
                  <iframe
                    src={currentPdfUrl}
                    title={currentPdfTitle}
                    frameBorder="0"
                    className="w-full h-full rounded-xl border border-slate-200 shadow-inner bg-white"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 py-20">
                    <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
                    <p className="mt-2 text-sm font-semibold">Cargando visualizador...</p>
                  </div>
                )}
              </div>
              
              {/* Footer del modal */}
              <div className="flex justify-end px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                <button
                  onClick={() => {
                    setPdfModalOpen(false);
                    setCurrentPdfUrl('');
                    setCurrentPdfTitle('');
                  }}
                  className="px-6 py-2.5 h-10 flex items-center justify-center text-sm font-semibold bg-[#003178] hover:bg-blue-900 text-white rounded-xl transition-all cursor-pointer text-center"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientDocuments;
