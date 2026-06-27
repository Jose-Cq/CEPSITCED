import React from 'react';

/**
 * Tarjeta de servicio visual e interactiva.
 * Componente puramente de presentación para el listado de servicios.
 * 
 * @param {object} props
 * @param {string} props.nombre - Nombre del servicio.
 * @param {string} props.descripcion - Descripción del servicio.
 * @param {number} props.duracion - Duración del servicio en minutos.
 * @param {string} [props.precioTexto] - Texto pre-calculado del precio a mostrar.
 * @param {number} [props.precio] - Precio base/final del servicio.
 * @param {boolean} props.isSelected - Si la tarjeta está seleccionada actualmente.
 * @param {function} props.onClick - Manejador de click.
 * @param {string} [props.className] - Clases de estilos adicionales.
 */
const ServiceCard = ({
  nombre,
  descripcion,
  duracion,
  precio,
  precioTexto,
  isSelected,
  onClick,
  className = ''
}) => {
  const displayPrecio = precioTexto !== undefined && precioTexto !== null
    ? precioTexto
    : (precio !== undefined && precio !== null ? `S/ ${precio}` : '');

  return (
    <button
      type="button"
      className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${
        isSelected
          ? 'border-[#003178] bg-blue-50/40 shadow-sm'
          : 'border-gray-205 hover:bg-gray-50'
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <h5 className="font-bold text-gray-900 text-base font-sans">{nombre}</h5>
          <p className="text-xs text-gray-555 mt-1 leading-relaxed">{descripcion || 'Sin descripción'}</p>
          {duracion !== undefined && duracion !== null && (
            <p className="text-xs text-[#003178] font-bold mt-2">Duración: {duracion} min</p>
          )}
        </div>
        {displayPrecio && (
          <span className="text-lg font-black text-[#003178] shrink-0 ml-4">
            {displayPrecio}
          </span>
        )}
      </div>
    </button>
  );
};

export default ServiceCard;
