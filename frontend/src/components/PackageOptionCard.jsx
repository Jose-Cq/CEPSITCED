import React from 'react';

/**
 * Tarjeta de opción de reserva o paquete.
 * Componente de presentación reutilizable para sesión individual, sesión con paquete,
 * paquetes de catálogo y paquetes adquiridos (pre-pagados).
 * 
 * @param {object} props
 * @param {string} props.title - Título de la tarjeta.
 * @param {string} props.description - Descripción o texto secundario.
 * @param {string} [props.priceText] - Texto de precio o tarifa promocional.
 * @param {string} [props.icon] - Nombre del icono de Material Symbols (si aplica).
 * @param {boolean} props.isSelected - Si la opción está seleccionada.
 * @param {function} props.onClick - Callback al hacer click.
 * @param {string} [props.theme] - Tema de color: 'blue' o 'emerald'. Por defecto 'blue'.
 * @param {string} [props.badge] - Badge de texto en la esquina superior derecha (e.g. 'Usar').
 * @param {string} [props.className] - Clases de estilos adicionales.
 */
const PackageOptionCard = ({
  title,
  description,
  priceText,
  icon,
  isSelected,
  onClick,
  theme = 'blue',
  badge,
  className = ''
}) => {
  // Determine styles based on theme and selection status
  let containerStyles = '';
  if (theme === 'emerald') {
    containerStyles = isSelected
      ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm bg-white'
      : 'border-emerald-200 hover:bg-emerald-50/30 bg-white';
  } else {
    // default/blue theme
    containerStyles = isSelected
      ? 'border-[#003178] bg-blue-50/40 shadow-sm'
      : 'border-gray-200 hover:bg-gray-50';
  }

  // Layout with icon (Normal Session / Session with Package buttons)
  if (icon) {
    return (
      <button
        type="button"
        className={`p-5 rounded-2xl border text-left cursor-pointer transition-all ${containerStyles} ${className}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
              isSelected ? 'bg-[#003178] text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm font-sans font-semibold">{title}</p>
            <p className="text-xs text-gray-555 mt-0.5">{description}</p>
            {priceText && (
              <p className={`text-sm font-black mt-2 ${theme === 'emerald' ? 'text-emerald-700' : 'text-[#003178]'}`}>
                {priceText}
              </p>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Layout without icon (Catalog Packages and Prepaid Acquired Packages)
  return (
    <button
      type="button"
      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${containerStyles} ${className}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <p className={`font-bold text-sm font-sans ${theme === 'emerald' ? 'text-emerald-900' : 'text-gray-900'}`}>
            {title}
          </p>
          <p className={`text-xs mt-0.5 ${theme === 'emerald' ? 'text-emerald-700' : 'text-gray-505'}`}>
            {description}
          </p>
          {priceText && (
            <p className={`text-sm font-black mt-2 ${theme === 'emerald' ? 'text-emerald-700' : 'text-[#003178]'}`}>
              {priceText}
            </p>
          )}
        </div>
        {badge && (
          <span
            className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 font-sans ${
              theme === 'emerald'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-blue-100 text-[#003178]'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
    </button>
  );
};

export default PackageOptionCard;
