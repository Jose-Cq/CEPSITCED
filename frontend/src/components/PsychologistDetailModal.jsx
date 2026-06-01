import React, { useEffect } from 'react';

const PsychologistDetailModal = ({ isOpen, onClose, psychologist }) => {
  // Deshabilitar scroll del fondo cuando el modal esté abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !psychologist) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      {/* Fondo oscuro con desenfoque */}
      <div
        className="fixed inset-0 bg-gray-950/70 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Caja del Modal */}
      <div className="relative bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl z-10 max-h-[90vh] flex flex-col md:flex-row animate-fade-in-up">

        {/* Botón de cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 h-10 w-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white shadow-sm border border-gray-100 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>

        {/* Columna Izquierda: Foto e Información de Atención (Fondo azul premium) */}
        <div className="w-full md:w-2/5 bg-gradient-to-b from-[#003178] to-blue-950 text-white p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

          <div>
            {/* Foto de Perfil */}
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden border-4 border-white/10 shadow-lg mx-auto mb-6 bg-blue-900/50">
              <img
                src={psychologist.foto}
                alt={psychologist.nombre}
                className="w-full h-full object-cover object-top"
              />
            </div>

            {/* Identificación Básica */}
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-black tracking-tight leading-tight mb-2">
                {psychologist.nombre}
              </h3>
              <p className="text-[#6cbdfe] font-bold text-xs uppercase tracking-wider mb-1">
                {psychologist.colegiatura}
              </p>
              <span className="inline-block bg-white/10 px-3 py-1 rounded-full text-xs font-medium border border-white/10 mt-2">
                Staff Permanente
              </span>
            </div>
          </div>

          {/* Información de Atención */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#6cbdfe] mb-3 flex items-center gap-1.5 justify-center md:justify-start">
              <span className="material-symbols-outlined text-[18px]">clinical_notes</span>
              Atención Clínica
            </h4>
            <div className="space-y-3 text-sm text-gray-200 text-center md:text-left">
              <p className="leading-relaxed">
                {psychologist.atencion}
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Trayectoria, Especialidades y Estudios */}
        <div className="w-full md:w-3/5 p-8 overflow-y-auto max-h-[50vh] md:max-h-none flex flex-col justify-between">
          <div>
            {/* Especialidad principal */}
            <div className="mb-6">
              <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                {psychologist.especialidad}
              </span>
            </div>

            {/* Perfil Profesional */}
            <div className="mb-8">
              <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003178] text-[20px]">psychology</span>
                Perfil Profesional
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                {psychologist.descripcion}
              </p>
            </div>

            {/* Estudios / Certificaciones */}
            {psychologist.estudios && (
              <div className="mb-6">
                <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#003178] text-[20px]">school</span>
                  Formación y Estudios
                </h4>
                <ul className="space-y-3">
                  {psychologist.estudios.map((estudio, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-gray-600 text-sm">
                      <span className="material-symbols-outlined text-green-500 text-[18px] mt-0.5 select-none">
                        check_circle
                      </span>
                      <span className="leading-relaxed">{estudio}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Botón de Reservar Cita */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">¿Deseas atenderte con ella?</p>
              <p className="text-sm text-gray-600">Agenda tu sesión en unos simples pasos.</p>
            </div>
            <button
              onClick={() => {
                onClose();
                // Redirigir a agendar cita o abrir modal de autenticación
                // Si el usuario está registrado, irá al dashboard. Si no, abrirá el portal.
                const portalBtn = document.querySelector('button[class*="Portal Pacientes"]') || document.querySelector('button');
                if (portalBtn) portalBtn.click();
              }}
              className="px-6 py-3 bg-[#003178] text-white font-bold rounded-2xl shadow-lg hover:bg-blue-900 hover:shadow-xl transition-all duration-300 text-sm uppercase tracking-wider w-full sm:w-auto active:scale-98"
            >
              Reservar Sesión
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PsychologistDetailModal;
