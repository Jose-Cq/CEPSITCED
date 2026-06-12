import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasValidImage } from '@backend/utils/formatters.js';

const HeroCarousel = ({ slides = [], loading = false, onOpenAuth }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handleButtonAction = (accion) => {
    if (!accion) return;
    if (accion === 'abrir_portal' || accion === '/auth') {
      onOpenAuth();
    } else if (accion.startsWith('#')) {
      const el = document.querySelector(accion);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (accion.startsWith('http')) {
      window.open(accion, '_blank');
    } else {
      navigate(accion);
    }
  };

  if (loading) {
    return (
      <section id="inicio" className="relative h-[680px] w-full bg-gray-950 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#000d1a] via-[#00224d] to-[#000d1a] overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/15 blur-[120px]" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-[#6cbdfe]/10 blur-[130px]" />
        </div>
        <div className="relative z-10 text-center">
          <div className="w-12 h-12 border-4 border-[#6cbdfe] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300 text-sm uppercase tracking-wider font-semibold">Cargando...</p>
        </div>
      </section>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <section id="inicio" className="relative h-[680px] w-full bg-gray-950 overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={slide.id || index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          {hasValidImage(slide.imagen_url) ? (
            <img
              src={slide.imagen_url}
              className="h-full w-full object-cover brightness-40 scale-100 transition-transform duration-[6000ms]"
              alt={slide.titulo || 'Fondo Hero'}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#000d1a] via-[#00224d] to-[#000d1a] overflow-hidden">
              <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/15 blur-[120px]" />
              <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-[#6cbdfe]/10 blur-[130px]" />
              <div className="absolute top-[30%] left-[35%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]" />
            </div>
          )}
          {/* Premium Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/30 to-transparent z-0"></div>

          <div className="absolute inset-0 flex items-center px-8 max-w-7xl mx-auto text-white z-10">
            <div className="max-w-3xl space-y-4">
              {slide.subtitulo && (
                <span className="inline-block bg-blue-500/20 text-[#6cbdfe] border border-blue-400/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                  {slide.subtitulo}
                </span>
              )}
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-4 uppercase tracking-tighter leading-none text-white drop-shadow-md">
                {slide.titulo}
              </h1>
              {slide.descripcion && (
                <p className="text-base sm:text-lg mb-8 font-medium leading-relaxed text-gray-200 max-w-2xl">
                  {slide.descripcion}
                </p>
              )}
              <button
                onClick={() => handleButtonAction(slide.boton_accion || 'abrir_portal')}
                className="rounded-2xl bg-[#6cbdfe] px-10 py-3.5 font-extrabold text-[#001d32] hover:bg-white transition-all transform hover:scale-102 hover:shadow-lg pointer-events-auto text-sm uppercase tracking-wider cursor-pointer"
              >
                {slide.boton_texto || 'Agendar Cita Ahora'}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Slide Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 z-20">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === currentSlide ? 'w-8 bg-[#6cbdfe]' : 'w-2.5 bg-white/40 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroCarousel;
