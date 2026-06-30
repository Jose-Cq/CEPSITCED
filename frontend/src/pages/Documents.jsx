import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { obtenerDocumentosPaciente } from '../utils/supabaseHelpers';

const Documents = ({ onNavigate }) => {
  const { loading: loadingProfile, error: profileError, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState('');
  const [currentPdfTitle, setCurrentPdfTitle] = useState('');

  useEffect(() => {
    const cargarDocumentos = async () => {
      if (loadingProfile) return;

      setLoadingDocs(true);
      setError('');
      try {
        let todosDocs = [];

        // 1. Cargar documentos del propio perfil (si existe ficha clínica)
        if (perfilClinicoPropio) {
          const res = await obtenerDocumentosPaciente(perfilClinicoPropio.id_paciente);
          if (res.success && res.data) {
            const docsP = res.data.map(d => ({
              id: d.id,
              titulo: d.servicios ? d.servicios.nombre_servicio : (d.tipo_documento || 'Trámite Documental'),
              fecha: new Date(d.created_at).toLocaleDateString('es-PE'),
              especialista: d.empleados ? `${d.empleados.nombres || ''} ${d.empleados.apellido_paterno || ''}`.trim() : 'Centro CEPSITCED',
              formato: 'PDF',
              tamaño: '1.2 MB',
              disponible: d.estado_pago === 'Pagado',
              paciente_nombre: d.pacientes ? `${d.pacientes.nombres || ''} ${d.pacientes.apellido_paterno || ''}`.trim() : 'Mí',
              archivo_pdf: d.archivo_pdf,
              tipo_documento: d.tipo_documento || 'Trámite Documental'
            }));
            todosDocs = [...todosDocs, ...docsP];
          }
        }

        // 2. Cargar documentos de los perfiles dependientes
        if (perfilesDependientes && perfilesDependientes.length > 0) {
          const promesas = perfilesDependientes.map(dep => obtenerDocumentosPaciente(dep.id_paciente));
          const resultados = await Promise.all(promesas);

          resultados.forEach((res, index) => {
            if (res.success && res.data) {
              const dep = perfilesDependientes[index];
              const docsDep = res.data.map(d => ({
                id: d.id,
                titulo: d.servicios ? d.servicios.nombre_servicio : (d.tipo_documento || 'Trámite Documental'),
                fecha: new Date(d.created_at).toLocaleDateString('es-PE'),
                especialista: d.empleados ? `${d.empleados.nombres || ''} ${d.empleados.apellido_paterno || ''}`.trim() : 'Centro CEPSITCED',
                formato: 'PDF',
                tamaño: '1.2 MB',
                disponible: d.estado_pago === 'Pagado',
                paciente_nombre: d.pacientes ? `${d.pacientes.nombres || ''} ${d.pacientes.apellido_paterno || ''}`.trim() : `${dep.nombres} ${dep.apellido_paterno}`,
                archivo_pdf: d.archivo_pdf,
                tipo_documento: d.tipo_documento || 'Trámite Documental'
              }));
              todosDocs = [...todosDocs, ...docsDep];
            }
          });
        }

        setDocuments(todosDocs);
      } catch (err) {
        console.error(err);
        setError("Error al cargar los documentos.");
      } finally {
        setLoadingDocs(false);
      }
    };

    cargarDocumentos();
  }, [loadingProfile, perfilClinicoPropio, perfilesDependientes]);

  const handleViewPdf = (doc) => {
    if (!doc.archivo_pdf) {
      toast.warning("No hay archivo disponible para visualizar.");
      return;
    }
    setCurrentPdfUrl(doc.archivo_pdf);
    setCurrentPdfTitle(doc.tipo_documento || 'Documento');
    setPdfModalOpen(true);
  };

  const handleDownload = (doc) => {
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

  return (
    <DashboardLayout currentPath="/dashboard/documents" onNavigate={onNavigate}>
      <div className="w-full space-y-6">
        {/* Encabezado de página */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Mis Documentos</h2>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            Accede a tus informes clínicos, evaluaciones y archivos compartidos de forma segura.
          </p>
        </div>

      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Cargando documentos...</span>
        </div>
      )}

      {currentError && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 mb-8 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500">error</span>
          {currentError}
        </div>
      )}

      {!loading && !currentError && (
        <>
          {/* Aviso de seguridad */}
          <div className="bg-gray-50 rounded-xl p-6 flex items-start gap-4 border border-gray-200 shadow-sm mb-8">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#003178]">lock</span>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900 mb-1">Acceso de Seguridad</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Los archivos solo aparecen si se cumple el estado de 'Sesiones Completadas' y 'Pagado' según la política del centro.
                Si crees que falta un documento, por favor contacta a tu psicólogo o recepción.
              </p>
            </div>
          </div>

          {/* Lista de documentos */}
          <div className="flex flex-col gap-4">
            {documents.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
                No hay documentos o informes disponibles para descargar en este momento.
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow duration-200 group ${!doc.disponible ? 'opacity-75' : ''
                    }`}
                >
                  <div className="flex items-start md:items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg border border-gray-200 flex items-center justify-center shrink-0 ${doc.disponible ? 'bg-gray-50 text-[#003178]' : 'bg-gray-100 text-gray-400'
                      }`}>
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        picture_as_pdf
                      </span>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{doc.titulo}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                          {doc.fecha}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 hidden md:block"></span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          {doc.especialista}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 hidden md:block"></span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                          {doc.formato} • {doc.tamaño}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 hidden md:block"></span>
                        <span className="bg-blue-50 text-[#003178] px-2 py-0.5 rounded text-xs font-bold">
                          Paciente: {doc.paciente_nombre}
                        </span>
                      </div>
                    </div>
                  </div>

                  {doc.disponible ? (
                    <div className="flex gap-2 self-start md:self-auto">
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
                      <button
                        onClick={() => handleDownload(doc)}
                        className="inline-flex items-center gap-1.5 bg-[#003178] hover:bg-blue-900 text-white transition-all px-3 h-9 rounded-lg text-xs font-medium shadow-sm cursor-pointer select-none"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download shrink-0">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" x2="12" y1="15" y2="3"/>
                        </svg>
                        Descargar
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled
                      className="self-start md:self-auto bg-gray-100 text-gray-400 rounded-lg px-4 py-2 font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[18px]">lock</span>
                      No Disponible (Pago Pendiente)
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
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

export default Documents;