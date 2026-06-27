import React from 'react';

/**
 * Tarjeta visual para un día individual en la grilla del calendario.
 * Componente puramente presentacional.
 * 
 * @param {object} props
 * @param {number|string} props.day - Número del día a mostrar.
 * @param {boolean} props.isSelected - Si el día está seleccionado actualmente.
 * @param {boolean} props.isEnabled - Si el día está habilitado/disponible para agendar.
 * @param {function} props.onClick - Manejador de click al seleccionar el día.
 * @param {string} [props.className] - Clases de estilos adicionales.
 */
const CalendarDayCard = ({
  day,
  isSelected,
  isEnabled,
  onClick,
  className = ''
}) => {
  return (
    <button
      type="button"
      disabled={!isEnabled}
      onClick={onClick}
      className={`py-2.5 rounded-xl font-bold transition-all ${
        isSelected
          ? 'bg-[#003178] text-white shadow-sm font-sans'
          : isEnabled
            ? 'bg-blue-50/60 hover:bg-blue-100/70 text-gray-900 border border-blue-100 cursor-pointer font-sans'
            : 'bg-gray-55 text-gray-300 border border-gray-100 cursor-not-allowed opacity-50 font-sans'
      } ${className}`}
    >
      {day}
    </button>
  );
};

export default CalendarDayCard;
