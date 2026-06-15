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
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState(3);
  const [isHovered, setIsHovered] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);
  
  const isTransitioningRef = useRef(false);

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
      setDisableTransition(true);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch locales and all services initially
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [localesData, servicesData] = await Promise.all([
          obtenerLocalesActivos(),
          obtenerServiciosLandingPorLocal('') // Get all active services
        ]);

        const servicesList = servicesData || [];
        const rawLocales = localesData || [];

        // Filter out locales that do NOT have any active service
        const filteredLocales = rawLocales.filter(loc => 
          servicesList.some(s => {
            const matchesDirect = s.local_id === loc.id;
            const matchesArray = Array.isArray(s.locales_ids) && s.locales_ids.includes(loc.id);
            return matchesDirect || matchesArray;
          })
        );

        setLocales(filteredLocales);
        setAllServices(servicesList);
      } catch (err) {
        console.error('Error fetching services and locales:', err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Filter services locally depending on local selection
  const services = selectedLocal
    ? allServices.filter(s => {
        const matchesDirect = s.local_id === selectedLocal;
        const matchesArray = Array.isArray(s.locales_ids) && s.locales_ids.includes(selectedLocal);
        return matchesDirect || matchesArray;
      })
    : allServices;

  const isSlider = services.length > visibleColumns;
  const extendedServices = isSlider 
    ? [...services, ...services.slice(0, visibleColumns)] 
    : services;

  const handleNext = () => {
    if (isTransitioningRef.current || !isSlider) return;
    isTransitioningRef.current = true;
    setDisableTransition(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (isTransitioningRef.current || !isSlider) return;
    isTransitioningRef.current = true;
    setDisableTransition(false);
    setCurrentIndex((prev) => prev - 1);
  };

  const handleTransitionEnd = () => {
    isTransitioningRef.current = false;
    if (currentIndex >= services.length) {
      setDisableTransition(true);
      setCurrentIndex(0);
    } else if (currentIndex < 0) {
      setDisableTransition(true);
      setCurrentIndex(services.length - 1);
    }
  };

  // Auto-play carrousel logic: pauses on hover, waits 3 seconds on mouse leave
  useEffect(() => {
    if (!isSlider || isHovered) return;

    const interval = setInterval(() => {
      handleNext();
    }, 3000); // 3 seconds interval

    return () => clearInterval(interval);
  }, [isSlider, isHovered, services.length, currentIndex]);

  // Re-enable transition smoothly after instant jump resets
  useEffect(() => {
    if (disableTransition) {
      const timer = setTimeout(() => {
        setDisableTransition(false);
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [disableTransition]);

  // Adjust current index if selected local filter changes the number of items
  useEffect(() => {
    setCurrentIndex(0);
    setDisableTransition(true);
    isTransitioningRef.current = false;
  }, [selectedLocal]);

  // Single card rendering helper
  const renderCard = (service) => (
    <div className="group bg-white rounded-3xl border border-slate-100 p-6 h-[340px] hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-left">
      <div>
        {/* Upper Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#003178] group-hover:bg-[#003178] group-hover:text-white transition-all duration-300">
          <span className="material-symbols-outlined text-[24px]">
            {service.icono || getServiceFallbackIcon(service.nombre_servicio)}
          </span>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1 leading-snug">{service.nombre_servicio}</h3>
        <p className="text-gray-550 text-xs leading-relaxed line-clamp-3">
          {service.descripcion || getServiceFallbackDesc(service.nombre_servicio)}
        </p>
      </div>

      <div className="space-y-3 pt-3 border-t border-slate-50">
        {/* Price or Consult */}
        <div className="text-left font-black text-lg text-[#003178]">
          {service.precio_sesion ? formatSoles(service.precio_sesion) : 'A consultar'}
        </div>

        {/* Booking Button */}
        <button
          onClick={onOpenAuth}
          className="w-full text-center bg-[#003178] hover:bg-blue-900 text-white font-bold py-2.5 px-4 rounded-2xl transition-all text-xs uppercase tracking-wider cursor-pointer shadow-sm no-flip"
        >
          Reservar Sesión
        </button>
      </div>
    </div>
  );

  // If there's 0 or 1 local with services, hide local selector.
  const showLocalFilter = locales.length > 1;

  return (
    <section id="servicios" className="py-16 md:py-20 bg-[#f9f9fc] border-b border-slate-100 overflow-hidden relative font-['Manrope']">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Especialidades
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-3 tracking-tighter uppercase leading-tight">
            Nuestros Servicios Clínicos
          </h2>
          <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full mb-6"></div>
        </div>

        {/* Local Filter Selector */}
        {showLocalFilter && (
          <div className="flex flex-wrap justify-center gap-3 mb-8">
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
          /* Static Centered Grid for 3 or fewer items (prevents slider overflow/spacing bugs) */
          <div className="flex flex-wrap justify-center gap-8">
            {services.map((service) => (
              <div key={service.id} className="w-full sm:w-[320px] md:w-[360px] flex-shrink-0">
                {renderCard(service)}
              </div>
            ))}
          </div>
        ) : (
          /* Responsive Infinite Loop Forward Slider with Hover Controls */
          <div 
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Carousel Container */}
            <div className="overflow-hidden">
              <div
                className="flex"
                onTransitionEnd={handleTransitionEnd}
                style={{
                  transform: `translateX(-${currentIndex * (100 / visibleColumns)}%)`,
                  transition: disableTransition ? 'none' : 'transform 500ms ease-out'
                }}
              >
                {extendedServices.map((service, index) => (
                  <div
                    key={`${service.id}-${index}`}
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
                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-12 h-12 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-lg hover:bg-slate-50 transition-all z-20 cursor-pointer"
                aria-label="Anterior"
              >
                <span className="material-symbols-outlined text-[24px] text-gray-700">chevron_left</span>
              </button>
              <button
                onClick={handleNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-12 h-12 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-lg hover:bg-slate-50 transition-all z-20 cursor-pointer"
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
