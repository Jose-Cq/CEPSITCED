import React, { useState, useEffect, useRef } from 'react';
import { obtenerEspecialistasLanding } from '@backend/services/especialistasService.js';
import PsychologistCard from './PsychologistCard.jsx';

const SpecialistsCarousel = ({ onOpenDetails }) => {
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState(3);

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

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    const maxIndex = Math.max(0, specialists.length - visibleColumns);
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  const maxIndex = Math.max(0, specialists.length - visibleColumns);
  const isSlider = specialists.length > visibleColumns;

  return (
    <section id="specialists" className="py-28 bg-white text-center relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Equipo Profesional
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-4 tracking-tighter uppercase">
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
          /* Static Centered Grid for 1 or 2 items (avoids slider overflow/spacing bugs) */
          <div className="flex flex-wrap justify-center gap-8">
            {specialists.map((psico) => (
              <div key={psico.id} className="w-full sm:w-[320px] md:w-[350px] flex-shrink-0 text-left">
                <PsychologistCard
                  psychologist={psico}
                  onOpenDetails={() => onOpenDetails(psico)}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Slider Container */
          <div className="relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{
                  transform: `translateX(-${currentIndex * (100 / visibleColumns)}%)`,
                }}
              >
                {specialists.map((psico) => (
                  <div
                    key={psico.id}
                    className="flex-shrink-0 px-4 text-left"
                    style={{ flex: `0 0 ${100 / visibleColumns}%` }}
                  >
                    <PsychologistCard
                      psychologist={psico}
                      onOpenDetails={() => onOpenDetails(psico)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Left and Right Nav Buttons */}
            <>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={`absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-12 h-12 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-lg hover:bg-slate-50 transition-all z-20 cursor-pointer ${
                  currentIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
                aria-label="Anterior"
              >
                <span className="material-symbols-outlined text-[24px] text-gray-700">chevron_left</span>
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex >= maxIndex}
                className={`absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-12 h-12 bg-white rounded-full border border-slate-100 flex items-center justify-center shadow-lg hover:bg-slate-50 transition-all z-20 cursor-pointer ${
                  currentIndex >= maxIndex ? 'opacity-0 pointer-events-none' : 'opacity-100'
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

export default SpecialistsCarousel;
