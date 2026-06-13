import React, { useState, useEffect, useRef } from 'react';
import { obtenerLocalesActivos, obtenerServiciosLandingPorLocal } from '@backend/services/serviciosService.js';
import { formatSoles } from '@backend/utils/formatters.js';

const getServiceFallbackIcon = (nombre) => {
  const name = (nombre || '').toLowerCase();
  if (name.includes('lenguaje')) return 'record_voice_over';
  if (name.includes('neuro') || name.includes('evalu')) return 'psychology';
  if (name.includes('adulto')) return 'person';
  if (name.includes('pareja') || name.includes('familiar')) return 'group';
  if (name.includes('infantil') || name.includes('niño')) return 'child_care';
  return 'healing';
};

const getServiceFallbackDesc = (nombre) => {
  const name = (nombre || '').toLowerCase();
  if (name.includes('lenguaje')) {
    return 'Evaluación y terapia para dificultades del habla, pronunciación y desarrollo del lenguaje en niños y adultos.';
  }
  if (name.includes('neuro') || name.includes('evalu')) {
    return 'Evaluación diagnóstica integral de las funciones cognitivas, conductuales y emocionales.';
  }
  if (name.includes('adulto')) {
    return 'Psicoterapia individual orientada a jóvenes y adultos para el manejo de ansiedad, depresión, estrés y desarrollo personal.';
  }
  return 'Servicio de atención y acompañamiento psicológico especializado.';
};

const ServicesCarousel = ({ onOpenAuth }) => {
  const [locales, setLocales] = useState([]);
  const [selectedLocal, setSelectedLocal] = useState(''); // '' means all
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState(3);

  // Detect responsive visible columns
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setVisibleColumns(3);
      } else if (width >= 768) {
        setVisibleColumns(2);
      } else {
        setVisibleColumns(1);
      }
      setCurrentIndex(0); // Reset index on resize
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch active locales
  useEffect(() => {
    const loadLocales = async () => {
      const data = await obtenerLocalesActivos();
      setLocales(data || []);
    };
    loadLocales();
  }, []);

  // Fetch services depending on local
  useEffect(() => {
    const loadServices = async () => {
      setLoading(true);
      const data = await obtenerServiciosLandingPorLocal(selectedLocal);
      setServices(data || []);
      setCurrentIndex(0); // Reset index on filter change
      setLoading(false);
    };
    loadServices();
  }, [selectedLocal]);

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    const maxIndex = Math.max(0, services.length - visibleColumns);
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  const maxIndex = Math.max(0, services.length - visibleColumns);
  const isSlider = services.length > visibleColumns;

  // Single card rendering helper
  const renderCard = (service) => (
    <div className="group bg-white rounded-3xl border border-slate-100 p-8 h-[420px] hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-left">
      <div>
        {/* Upper Icon */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#003178] group-hover:bg-[#003178] group-hover:text-white transition-all duration-300">
          <span className="material-symbols-outlined text-[28px]">
            {service.icono || getServiceFallbackIcon(service.nombre_servicio)}
          </span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-1">{service.nombre_servicio}</h3>
        <p className="text-gray-550 text-sm leading-relaxed mb-6 line-clamp-3">
          {service.descripcion || getServiceFallbackDesc(service.nombre_servicio)}
        </p>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-50">
        {/* Metadata: Duration & Price */}
        <div className="flex justify-between items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">

          </span>
          <span className="text-sm font-bold text-gray-900">
            {formatSoles(service.precio_sesion)}
          </span>
        </div>

        {/* Booking Button */}
        <button
          onClick={onOpenAuth}
          className="w-full text-center bg-[#003178] hover:bg-blue-900 text-white font-bold py-3 px-4 rounded-2xl transition-all text-xs uppercase tracking-wider cursor-pointer shadow-sm"
        >
          Reservar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <section id="servicios" className="py-28 bg-[#f9f9fc] border-b border-slate-100 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Especialidades
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-4 tracking-tighter uppercase animate-fadeIn">
            Nuestros Servicios Clínicos
          </h2>
          <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full mb-8"></div>
        </div>

        {/* Local Filter Selector */}
        {locales.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            <button
              onClick={() => setSelectedLocal('')}
              className={`px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border ${selectedLocal === ''
                ? 'bg-[#003178] text-white border-[#003178] shadow-md'
                : 'bg-white text-gray-650 border-slate-200 hover:border-[#003178] hover:text-[#003178]'
                }`}
            >
              Todos los Locales
            </button>
            {locales.map((loc) => (
              <button
                key={loc.id}
                onClick={() => setSelectedLocal(loc.id)}
                className={`px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border ${selectedLocal === loc.id
                  ? 'bg-[#003178] text-white border-[#003178] shadow-md'
                  : 'bg-white text-gray-650 border-slate-200 hover:border-[#003178] hover:text-[#003178]'
                  }`}
              >
                {loc.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Services Loading State */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-650 font-bold">Cargando especialidades...</span>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">warning</span>
            <p className="text-gray-550 text-base font-semibold">No se encontraron servicios para este local.</p>
          </div>
        ) : !isSlider ? (
          /* Static Centered Grid for 1 or 2 items (prevents slider overflow/spacing bugs) */
          <div className="flex flex-wrap justify-center gap-8">
            {services.map((service) => (
              <div key={service.id} className="w-full sm:w-[320px] md:w-[360px] flex-shrink-0">
                {renderCard(service)}
              </div>
            ))}
          </div>
        ) : (
          /* Responsive Slider */
          <div className="relative">
            {/* Carousel Container */}
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{
                  transform: `translateX(-${currentIndex * (100 / visibleColumns)}%)`,
                }}
              >
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex-shrink-0 px-4"
                    style={{ flex: `0 0 ${100 / visibleColumns}%` }}
                  >
                    {renderCard(service)}
                  </div>
                ))}
              </div>
            </div>

            {/* Left and Right Nav Buttons */}
            <>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={`absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-12 h-12 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-lg hover:bg-slate-50 transition-all z-20 cursor-pointer ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                aria-label="Anterior"
              >
                <span className="material-symbols-outlined text-[24px] text-gray-700">chevron_left</span>
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex >= maxIndex}
                className={`absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-12 h-12 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-lg hover:bg-slate-50 transition-all z-20 cursor-pointer ${currentIndex >= maxIndex ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                aria-label="Siguiente"
              >
                <span className="material-symbols-outlined text-[24px] text-gray-700">chevron_right</span>
              </button>
            </>
          </div>
        )}
      </div>
    </section>
  );
};

export default ServicesCarousel;
