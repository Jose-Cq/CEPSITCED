import React, { useState, useEffect, useRef } from 'react';

const TestimonialsCarousel = ({ testimonios = [] }) => {
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

  const isSlider = testimonios.length > visibleColumns;
  const extendedTestimonios = isSlider 
    ? [...testimonios, ...testimonios.slice(0, visibleColumns)] 
    : testimonios;

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
    if (currentIndex >= testimonios.length) {
      setDisableTransition(true);
      setCurrentIndex(0);
    } else if (currentIndex < 0) {
      setDisableTransition(true);
      setCurrentIndex(testimonios.length - 1);
    }
  };

  // Autoplay Logic: slides every 4 seconds, pauses on hover, wraps forward smoothly
  useEffect(() => {
    if (!isSlider || isHovered) return;

    const interval = setInterval(() => {
      handleNext();
    }, 4000); // 4 seconds interval

    return () => clearInterval(interval);
  }, [isSlider, isHovered, testimonios.length, currentIndex]);

  // Re-enable transition smoothly after instant jump resets
  useEffect(() => {
    if (disableTransition) {
      const timer = setTimeout(() => {
        setDisableTransition(false);
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [disableTransition]);

  if (testimonios.length === 0) {
    return null;
  }

  // Single card rendering helper
  const renderCard = (item) => (
    <div className="group bg-white rounded-3xl border border-slate-100 p-8 h-[260px] hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col justify-between text-left">
      <div>
        {/* Star Rating */}
        <div className="flex gap-1 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`material-symbols-outlined text-[20px] ${
                i < (item.calificacion || 5)
                  ? 'text-amber-400 font-filled fill-current'
                  : 'text-gray-250'
              }`}
              style={{
                fontVariationSettings:
                  i < (item.calificacion || 5)
                    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0",
              }}
            >
              star
            </span>
          ))}
        </div>
        <p className="text-gray-550 text-sm leading-relaxed italic line-clamp-4 font-medium">
          "{item.comentario}"
        </p>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-[#003178] font-bold text-sm">
          {String(item.nombre_ficticio || 'P').charAt(0).toUpperCase()}
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-900">
            {item.nombre_ficticio || 'Paciente Anónimo'}
          </h4>
          <span className="text-xs text-gray-400">Paciente Verificado</span>
        </div>
      </div>
    </div>
  );

  return (
    <section id="testimonios" className="py-16 md:py-20 bg-[#f9f9fc] border-t border-slate-100 relative overflow-hidden font-['Manrope']">
      {/* Background Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-50/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Opiniones
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-3 tracking-tighter uppercase leading-tight">
            Testimonios de Pacientes
          </h2>
          <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full"></div>
        </div>

        {!isSlider ? (
          /* Centered grid for 3 or fewer items */
          <div className="flex flex-wrap justify-center gap-8">
            {testimonios.map((item) => (
              <div key={item.id} className="w-full sm:w-[320px] md:w-[360px] flex-shrink-0">
                {renderCard(item)}
              </div>
            ))}
          </div>
        ) : (
          /* Sliding Track with infinite forward loop and hover controls */
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
                {extendedTestimonios.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="flex-shrink-0 px-4"
                    style={{ flex: `0 0 ${100 / visibleColumns}%` }}
                  >
                    {renderCard(item)}
                  </div>
                ))}
              </div>
            </div>

            {/* Carousel Navigation Buttons */}
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

export default TestimonialsCarousel;
