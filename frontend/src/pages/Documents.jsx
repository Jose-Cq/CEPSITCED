import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { obtenerDocumentosPaciente } from '../utils/supabaseHelpers';

const Documents = ({ onNavigate }) => {
  const { loading: loadingProfile, error: profileError, perfilClinicoPropio, perfilesDependientes } = usePacienteActual();
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState('');

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
              titulo: d.tipo_documento || 'Trámite Documental',
              fecha: new Date(d.created_at).toLocaleDateString('es-PE'),
              especialista: 'Centro CEPSITCED',
              formato: 'PDF',
              tamaño: '1.2 MB',
              disponible: d.estado_pago === 'Pagado',
              paciente_nombre: 'Mí'
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
                titulo: d.tipo_documento || 'Trámite Documental',
                fecha: new Date(d.created_at).toLocaleDateString('es-PE'),
                especialista: 'Centro CEPSITCED',
                formato: 'PDF',
                tamaño: '1.2 MB',
                disponible: d.estado_pago === 'Pagado',
                paciente_nombre: `${dep.nombres} ${dep.apellido_paterno}`
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

  const handleDownload = (doc) => {
    console.log('Descargando:', doc.titulo);
    alert(`Descargando ${doc.titulo}...`);
  };

  const loading = loadingProfile || loadingDocs;
  const currentError = profileError || error;

  return (
    <DashboardLayout currentPath="/dashboard/documents" onNavigate={onNavigate}>
      {/* Encabezado de página */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Mis Documentos</h2>
        <p className="text-gray-500 text-lg mt-2">
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
                    <button
                      onClick={() => handleDownload(doc)}
                      className="self-start md:self-auto bg-[#003178] text-white rounded-lg px-4 py-2 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-900 transition-colors shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      Descargar
                    </button>
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
    </DashboardLayout>
  );
};

export default Documents;