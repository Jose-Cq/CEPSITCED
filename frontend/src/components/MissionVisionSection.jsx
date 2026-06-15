import React, { useEffect, useRef, useState } from 'react';

const MissionVisionSection = ({ config = null, loading = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    if (loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [loading]);

  if (loading) {
    return (
      <section id="nosotros" className="py-28 bg-[#f8fafc] border-y border-slate-100 flex items-center justify-center font-['Manrope']">
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
  const safeMisionText = config?.mision_texto || 'Ofrecer y brindar servicios psicológicos dirigidos a estudiantes, instituciones y comunidades, promoviendo la salud mental en nuestra sociedad a través de una atención responsable, ética y comprometida con el bienestar de los pacientes en todas las áreas.';
  const safeVisionSub = config?.vision_subtitulo || 'Compromiso Ético y Calidad';
  const safeVisionText = config?.vision_texto || 'Ser una institución destacada y reconocida en el ámbito de la salud mental y el apoyo a instituciones educativas, contribuyendo a la prevención, promoción e intervención psicológica con calidad humana, ética profesional y compromiso social.';

  return (
    <section
      id="nosotros"
      ref={sectionRef}
      className="py-16 md:py-20 bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100/50 border-y border-slate-100 relative overflow-hidden font-['Manrope']"
    >
      {/* Background soft ambient effects */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-blue-100/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-sky-100/20 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Nosotros
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-4 tracking-tighter uppercase leading-tight">
            Misión & Visión
          </h2>
          <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 items-stretch">

          {/* Left Side: Elegant Image */}
          <div
            className={`lg:col-span-5 flex flex-col items-stretch transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
              }`}
          >
            <div className="relative w-full rounded-3xl border border-slate-100/80 bg-white p-8 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 flex flex-col items-center justify-center min-h-[420px] flex-1">
              <img
                src="/logo-cepsitced.png"
                alt="Logo CEPSITCED"
                className="max-w-[260px] max-h-[220px] object-contain select-none transition-transform duration-500 hover:scale-105"
              />
              {/* Sello de confianza flotante */}
              <div className="absolute -bottom-4 -right-4 bg-[#003178] text-white p-5 rounded-2xl shadow-xl hidden sm:flex items-center gap-3 border border-blue-800">
                <span className="material-symbols-outlined text-[32px] text-[#6cbdfe]">workspace_premium</span>
                <div className="text-left">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Atención Ética</p>
                  <p className="text-sm font-black text-white leading-none">100% Profesional</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Composition of Mission & Vision */}
          <div
            className={`lg:col-span-7 space-y-8 transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
              }`}
          >
            {/* Misión Card */}
            <div className="group rounded-3xl bg-white border border-slate-100/80 p-8 md:p-10 text-left hover:shadow-xl hover:border-blue-300 hover:scale-[1.01] hover:bg-blue-50/40 transition-all duration-300 ease-out flex flex-col justify-between relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/40 rounded-bl-full pointer-events-none group-hover:scale-125 transition-transform duration-500" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 uppercase tracking-tight">Nuestra Misión</h3>
                <p className="text-[#003178] font-bold text-xs uppercase tracking-wider border-l-4 border-[#6cbdfe] pl-3 mb-3">
                  {safeMisionSub}
                </p>
                <p className="text-gray-650 text-sm leading-relaxed whitespace-pre-line">
                  {safeMisionText}
                </p>
              </div>
            </div>

            {/* Visión Card */}
            <div className="group rounded-3xl bg-white border border-slate-100/80 p-8 md:p-10 text-left hover:shadow-xl hover:border-blue-300 hover:scale-[1.01] hover:bg-blue-50/40 transition-all duration-300 ease-out flex flex-col justify-between relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/40 rounded-bl-full pointer-events-none group-hover:scale-125 transition-transform duration-500" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 uppercase tracking-tight">Nuestra Visión</h3>
                <p className="text-[#003178] font-bold text-xs uppercase tracking-wider border-l-4 border-[#6cbdfe] pl-3 mb-3">
                  {safeVisionSub}
                </p>
                <p className="text-gray-650 text-sm leading-relaxed whitespace-pre-line">
                  {safeVisionText}
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default MissionVisionSection;
