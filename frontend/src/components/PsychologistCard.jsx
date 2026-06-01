import React from 'react';

const PsychologistCard = ({ psychologist, onOpenDetails }) => {
  return (
    <div
      className="group relative bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col h-full cursor-pointer"
      onClick={onOpenDetails}
    >
      {/* Imagen del perfil */}
      <div className="relative h-72 w-full overflow-hidden bg-gray-100">
        <img
          src={psychologist.foto}
          alt={psychologist.nombre}
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
          <span className="text-white text-xs font-semibold tracking-wider uppercase bg-[#6cbdfe]/80 backdrop-blur-sm px-3.5 py-1.5 rounded-full">
            Ver Trayectoria
          </span>
        </div>
      </div>

      {/* Contenido de la tarjeta */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <span className="text-xs font-bold text-[#003178]/80 uppercase tracking-widest block mb-2">
            {psychologist.especialidad.split(' - ')[0] || 'Especialista'}
          </span>
          <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#003178] transition-colors mb-3 leading-snug">
            {psychologist.nombre}
          </h3>
          <p className="text-xs text-gray-400 font-semibold mb-3">
            Colegiatura: {psychologist.colegiatura}
          </p>
          <p className="text-gray-500 text-sm line-clamp-3 leading-relaxed mb-6">
            {psychologist.descripcion}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails();
          }}
          className="w-full py-3 bg-gray-50 text-[#003178] font-bold rounded-2xl group-hover:bg-[#003178] group-hover:text-white transition-all duration-300 text-sm flex items-center justify-center gap-2"
        >
          <span>Conoce más</span>
          <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:translate-x-1">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
};

export default PsychologistCard;
