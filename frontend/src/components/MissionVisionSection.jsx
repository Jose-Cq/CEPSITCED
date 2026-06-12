import React from 'react';

const MissionVisionSection = ({ config = null, loading = false }) => {
  if (loading) {
    return (
      <section id="nosotros" className="py-28 bg-white border-y border-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-550 font-semibold text-sm">Cargando misión y visión...</p>
        </div>
      </section>
    );
  }

  // Explicit check to hide the section
  if (config && config.mostrar_nosotros === false) {
    return null;
  }

  // Fallbacks if configuration table has no rows or is empty
  const safeMisionSub = config?.mision_subtitulo || 'Salud y Bienestar Emocional';
  const safeMisionText = config?.mision_texto || 'Ofrecer y brindar servicios psicológicos clínicos y psicopedagógicos de calidad, promoviendo de manera activa la salud mental y el bienestar emocional en todas las áreas de la vida de nuestros pacientes.';
  const safeVisionSub = config?.vision_subtitulo || 'Compromiso Ético y Calidad';
  const safeVisionText = config?.vision_texto || 'Ser un centro de referencia líder en la atención psicológica de nuestra comunidad, reconocido por la calidez humana, el rigor ético y la precisión científica en cada uno de nuestros tratamientos.';

  return (
    <section id="nosotros" className="py-28 bg-white border-y border-slate-100 relative overflow-hidden">
      {/* Background soft ambient effects */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-blue-50/50 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-50/30 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Nuestra Identidad
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-4 tracking-tighter uppercase leading-tight">
            Misión & Visión
          </h2>
          <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch">
          {/* Misión Card */}
          <div className="group rounded-3xl bg-[#f9f9fc] border border-slate-100 p-8 md:p-10 text-left hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#003178] group-hover:bg-[#003178] group-hover:text-white transition-all duration-300">
                <span className="material-symbols-outlined text-[28px]">clinical_notes</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 uppercase tracking-tight">Nuestra Misión</h3>
              <p className="text-[#003178] font-bold text-xs uppercase tracking-wider border-l-4 border-[#6cbdfe] pl-3 mb-4">
                {safeMisionSub}
              </p>
              <p className="text-gray-650 text-sm leading-relaxed whitespace-pre-line">
                {safeMisionText}
              </p>
            </div>
          </div>

          {/* Visión Card */}
          <div className="group rounded-3xl bg-[#f9f9fc] border border-slate-100 p-8 md:p-10 text-left hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#003178] group-hover:bg-[#003178] group-hover:text-white transition-all duration-300">
                <span className="material-symbols-outlined text-[28px]">visibility</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 uppercase tracking-tight">Nuestra Visión</h3>
              <p className="text-[#003178] font-bold text-xs uppercase tracking-wider border-l-4 border-[#6cbdfe] pl-3 mb-4">
                {safeVisionSub}
              </p>
              <p className="text-gray-650 text-sm leading-relaxed whitespace-pre-line">
                {safeVisionText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MissionVisionSection;
