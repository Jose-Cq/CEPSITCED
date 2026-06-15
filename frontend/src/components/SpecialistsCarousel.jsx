import React, { useState, useEffect, useRef } from 'react';
import { obtenerEspecialistasLanding } from '@backend/services/especialistasService.js';
import PsychologistCard from './PsychologistCard.jsx';

const SpecialistsCarousel = ({ onOpenDetails, onOpenAuth }) => {
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState(3);
  const [isHovered, setIsHovered] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);

  const isTransitioningRef = useRef(false);

  // Responsive columns detect
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
      setCurrentIndex(0);
      setDisableTransition(true);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch active specialists
  useEffect(() => {
    const loadSpecialists = async () => {
      setLoading(true);
      const data = await obtenerEspecialistasLanding();
      setSpecialists(data || []);
      setLoading(false);
    };
    loadSpecialists();
  }, []);

  const isSlider = specialists.length > 3;
  const extendedSpecialists = isSlider 
    ? [...specialists, ...specialists.slice(0, visibleColumns)] 
    : specialists;

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
    if (currentIndex >= specialists.length) {
      setDisableTransition(true);
      setCurrentIndex(0);
    } else if (currentIndex < 0) {
      setDisableTransition(true);
      setCurrentIndex(specialists.length - 1);
    }
  };

  // Autoplay Logic: slides every 5 seconds, pauses on hover, wraps around forward smoothly
  useEffect(() => {
    if (!isSlider || isHovered) return;

    const interval = setInterval(() => {
      handleNext();
    }, 5000); // 5 seconds interval

    return () => clearInterval(interval);
  }, [isSlider, isHovered, specialists.length, currentIndex]);

  // Re-enable transition smoothly after instant jump resets
  useEffect(() => {
    if (disableTransition) {
      const timer = setTimeout(() => {
        setDisableTransition(false);
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [disableTransition]);

  return (
    <section id="specialists" className="py-16 md:py-20 bg-white text-center relative overflow-hidden font-['Manrope']">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Equipo Profesional
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-3 tracking-tighter uppercase leading-tight">
            Nuestros Especialistas
          </h2>
          <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full"></div>
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-650 font-bold">Cargando especialistas...</span>
          </div>
        ) : specialists.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">people</span>
            <p className="text-gray-550 text-base font-semibold">No hay especialistas disponibles por el momento.</p>
          </div>
        ) : !isSlider ? (
          /* Static Centered Grid for 3 or fewer items (avoids slider overflow/spacing bugs) */
          <div className={`grid ${
            specialists.length === 1 ? 'grid-cols-1 max-w-sm' :
            specialists.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl' :
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-5xl'
          } gap-8 items-stretch mx-auto w-full`}>
            {specialists.map((psico) => (
              <div key={psico.id} className="w-full max-w-[360px] mx-auto flex flex-col h-full text-left">
                <PsychologistCard
                  psychologist={psico}
                  onOpenDetails={() => onOpenDetails(psico)}
                  onOpenAuth={onOpenAuth}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Slider Container with Forward Infinite Loop and Hover Controls */
          <div 
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="overflow-hidden">
              <div
                className="flex"
                onTransitionEnd={handleTransitionEnd}
                style={{
                  transform: `translateX(-${currentIndex * (100 / visibleColumns)}%)`,
                  transition: disableTransition ? 'none' : 'transform 500ms ease-out'
                }}
              >
                {extendedSpecialists.map((psico, index) => (
                  <div
                    key={`${psico.id}-${index}`}
                    className="flex-shrink-0 px-4 text-left"
                    style={{ flex: `0 0 ${100 / visibleColumns}%` }}
                  >
                    <div className="w-full max-w-[360px] mx-auto flex flex-col h-full">
                      <PsychologistCard
                        psychologist={psico}
                        onOpenDetails={() => onOpenDetails(psico)}
                        onOpenAuth={onOpenAuth}
                      />
                    </div>
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

export default SpecialistsCarousel;
