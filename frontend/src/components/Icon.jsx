/**
 * Componente wrapper para iconos de Material Symbols.
 * Protege contra la traducción automática del navegador.
 *
 * Uso:
 *   <Icon>check</Icon>
 *   <Icon size="text-2xl" color="text-red-500">error</Icon>
 */
const Icon = ({ children, size = '', color = '', className = '', ...props }) => {
  const sizeClass = size || '';
  const colorClass = color || '';

  return (
    <span
      className={`material-symbols-outlined ${sizeClass} ${colorClass} ${className}`}
      translate="no"
      notranslate="notranslate"
      aria-hidden="true"
      {...props}
    >
      {children}
    </span>
  );
};

export default Icon;
