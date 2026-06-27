import React from 'react';

/**
 * Tarjeta visual para un slot/rango de horario en la lista de horas.
 * Componente puramente presentacional.
 * 
 * @param {object} props
 * @param {string} props.inicio - Hora de inicio (ej. '09:00').
 * @param {string} props.fin - Hora de fin (ej. '09:30').
 * @param {boolean} props.isSelected - Si el slot está seleccionado.
 * @param {boolean} [props.isDisabled] - Si el slot está deshabilitado.
 * @param {function} props.onClick - Manejador de click.
 * @param {string} [props.className] - Clases de estilos adicionales.
 */
const TimeSlotCard = ({
  inicio,
  fin,
  isSelected,
  isDisabled = false,
  onClick,
  className = ''
}) => {
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={`p-2.5 rounded-xl border text-center font-bold text-xs h-10 flex items-center justify-center transition-all ${
        isSelected
          ? 'bg-[#003178] border-[#003178] text-white shadow-sm font-sans'
          : isDisabled
            ? 'bg-gray-55 text-gray-300 border border-gray-100 cursor-not-allowed opacity-50 font-sans'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55 cursor-pointer'
      } ${className}`}
    >
      {inicio} - {fin}
    </button>
  );
};

export default TimeSlotCard;
