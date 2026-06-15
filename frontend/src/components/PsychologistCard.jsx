import React, { useState } from 'react';

const getInitials = (value = '') => {
  const safeValue = String(value || 'Especialista').trim();
  return safeValue
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const PsychologistCard = ({ psychologist, onOpenDetails, onOpenAuth }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const safeName = psychologist?.nombreCompleto || psychologist?.nombre || 'Especialista';
  const safeCargo = String(psychologist?.cargo || 'Psicólogo(a)').toUpperCase();
  const safeArea = String(psychologist?.area || '').toUpperCase();
  const safeDescription = psychologist?.perfilProfesional || psychologist?.descripcion || 'Especialista en psicología con enfoque integral.';
  const safeColegiatura = psychologist?.nroCpsp || '';
  const safeFoto = psychologist?.imagenPerfilUrl || psychologist?.foto;
  const safeAtencion = psychologist?.horario || 'Horarios a consultar.';
  const safeModalidad = psychologist?.modalidad || 'Presencial y Virtual';
  const safeEstudios = psychologist?.formaciones || psychologist?.estudios || ['Licenciatura en Psicología'];

  const handleCardClick = (e) => {
    // If user clicked any element with "no-flip", don't flip
    if (e.target.closest('.no-flip')) {
      return;
    }
    const isTouch = window.matchMedia('(hover: none)').matches;
    if (isTouch) {
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <div
      className={`specialist-card-container ${isFlipped ? 'flipped' : ''}`}
      onClick={handleCardClick}
    >
      <div className="specialist-card-inner">
        
        {/* Front of Card */}
        <div className="specialist-card-front flex flex-col justify-between h-full bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          {/* Profile Image Area */}
          <div className="relative h-64 w-full overflow-hidden bg-slate-50 flex items-center justify-center">
            {safeFoto ? (
              <img
                src={safeFoto}
                alt={safeName}
                className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-100 text-[#003178] flex items-center justify-center text-3xl font-bold uppercase shadow-sm">
                {getInitials(safeName)}
              </div>
            )}
          </div>

          {/* Front Content */}
          <div className="p-6 flex-1 flex flex-col justify-between text-left min-h-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              <span className="text-xs font-bold text-[#003178]/80 uppercase tracking-widest block mb-1 whitespace-normal break-words leading-tight">
                {safeCargo}{safeArea ? ` - ${safeArea}` : ''}
              </span>
              <h3 className="text-lg font-black text-gray-900 mb-2 leading-tight whitespace-normal break-words">
                {safeName}
              </h3>
              {safeColegiatura && (
                <p className="text-[11px] text-gray-400 font-semibold mb-3 leading-tight whitespace-normal break-words">
                  Colegiatura: {safeColegiatura}
                </p>
              )}
              {safeDescription && (
                <p className="text-gray-650 text-xs leading-relaxed line-clamp-6 whitespace-normal break-words">
                  {safeDescription}
                </p>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails();
              }}
              className="no-flip mt-4 w-full py-2.5 bg-gray-55 bg-gray-50 hover:bg-[#003178] text-[#003178] hover:text-white font-bold rounded-2xl transition-all duration-300 text-xs flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
            >
              <span>Conoce más</span>
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </button>
          </div>
        </div>

        {/* Back of Card */}
        <div className="specialist-card-back bg-slate-50 border border-slate-200 rounded-3xl p-6 text-left flex flex-col h-full">
          <div className="flex-grow flex flex-col min-h-0">
            <div>
              <h3 className="text-lg font-black text-[#003178] mb-1 leading-tight whitespace-normal break-words">{safeName}</h3>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-3 border-b border-slate-200 pb-1.5 whitespace-normal break-words leading-tight">
                {safeCargo}{safeArea ? ` / ${safeArea}` : ''}
              </p>
            </div>
            
            <div className="overflow-y-auto pr-1 space-y-3 flex-1 scrollbar-thin scroll-smooth min-h-0">
              {/* Formación */}
              {safeEstudios && safeEstudios.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-gray-450 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">school</span>
                    Formación
                  </p>
                  <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside pl-1">
                    {safeEstudios.map((est, idx) => (
                      <li key={idx} className="leading-snug whitespace-normal break-words">{est}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Modalidad */}
              {safeModalidad && (
                <div>
                  <p className="text-[10px] font-black text-gray-450 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">videocam</span>
                    Modalidad
                  </p>
                  <p className="text-xs text-gray-750 font-bold whitespace-normal break-words leading-tight">{safeModalidad}</p>
                </div>
              )}

              {/* Horario */}
              {safeAtencion && (
                <div>
                  <p className="text-[10px] font-black text-gray-450 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                    Horarios
                  </p>
                  <p className="text-xs text-gray-650 leading-snug whitespace-normal break-words">{safeAtencion}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenAuth) onOpenAuth();
              }}
              className="no-flip w-full py-2.5 bg-[#003178] hover:bg-blue-900 text-white font-bold rounded-2xl transition-all duration-300 text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">event</span>
              <span>Reservar sesión</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PsychologistCard;
