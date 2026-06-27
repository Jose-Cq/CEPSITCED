import React from 'react';

/**
 * Tarjeta de selección interactiva con diseño uniforme y soporte responsive.
 * 
 * @param {object} props
 * @param {string} props.icon - Nombre del icono de Material Symbols.
 * @param {string} props.title - Título principal de la tarjeta.
 * @param {string} props.description - Descripción o texto secundario.
 * @param {boolean} props.isSelected - Si la tarjeta está seleccionada actualmente.
 * @param {function} props.onClick - Manejador de click.
 * @param {string} [props.className] - Clases de estilos adicionales.
 */
const SelectableCard = ({
  icon,
  title,
  description,
  isSelected,
  onClick,
  className = ''
}) => {
  return (
    <button
      type="button"
      className={`w-full sm:w-[270px] h-[88px] p-4 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-3 shrink-0 ${
        isSelected
          ? 'border-[#003178] bg-blue-50/40 shadow-sm'
          : 'border-gray-200 hover:bg-gray-55'
      } ${className}`}
      onClick={onClick}
    >
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
          isSelected ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
        }`}
      >
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900 text-sm font-sans truncate">{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 font-sans leading-tight truncate" title={description}>
          {description}
        </p>
      </div>
    </button>
  );
};

export default SelectableCard;
