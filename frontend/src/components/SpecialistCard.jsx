import React from 'react';

/**
 * Tarjeta de especialista visual e interactiva.
 * Componente puramente de presentación para el listado de psicólogos/especialistas.
 * 
 * @param {object} props
 * @param {string} props.nombres - Nombres y apellidos del especialista.
 * @param {string} [props.area] - Área de especialidad.
 * @param {string} props.correo - Correo electrónico del especialista.
 * @param {string} props.foto - URL o ruta de la foto del especialista.
 * @param {string} props.fechaProx - Fecha de próxima disponibilidad en formato YYYY-MM-DD.
 * @param {string} [props.precioTexto] - Precio formateado opcional (solo si se especifica).
 * @param {boolean} props.isSelected - Si la tarjeta está seleccionada actualmente.
 * @param {function} props.onClick - Manejador de click.
 * @param {string} [props.className] - Clases de estilos adicionales.
 */
const SpecialistCard = ({
  nombres,
  area,
  correo,
  foto,
  fechaProx,
  precioTexto,
  isSelected,
  onClick,
  className = ''
}) => {
  const displayFecha = fechaProx
    ? new Date(fechaProx + 'T00:00:00').toLocaleDateString('es-PE')
    : null;

  return (
    <button
      type="button"
      className={`flex flex-col bg-white rounded-2xl border overflow-hidden text-left cursor-pointer transition-all ${
        isSelected
          ? 'border-[#003178] ring-2 ring-blue-50/50 shadow-md animate-in fade-in duration-100'
          : 'border-gray-200 hover:bg-gray-50 hover:shadow-sm'
      } ${className}`}
      onClick={onClick}
    >
      <div className="h-44 w-full overflow-hidden bg-gray-100 relative">
        <img
          src={foto || '/default_perfil psychology.jpeg'}
          alt={nombres}
          className="w-full h-full object-cover object-top"
        />
        {isSelected && (
          <div className="absolute top-3 right-3 bg-[#003178] text-white rounded-full p-1 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">check</span>
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between w-full">
        <div>
          <h5 className="font-bold text-gray-900 text-sm leading-tight font-sans">{nombres}</h5>
          {area && <p className="text-xs text-gray-500 mt-0.5">{area}</p>}
          {/* Email is hidden */}
        </div>

        {precioTexto && (
          <p className="text-xs font-black text-[#003178] mt-2 font-sans">
            {precioTexto}
          </p>
        )}

        {displayFecha && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#003178] text-[16px]">calendar_today</span>
            <span className="text-[11px] font-bold text-[#003178] font-sans">
              Disponible desde: {displayFecha}
            </span>
          </div>
        )}
      </div>
    </button>
  );
};

export default SpecialistCard;
