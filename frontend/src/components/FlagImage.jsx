import React, { useState } from 'react';

export const getFlagEmoji = (iso2) => {
  if (!iso2) return '';
  const codePoints = iso2
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const FlagImage = ({ iso2, className = "w-5 h-3.5 object-cover rounded-sm border border-gray-200 shrink-0" }) => {
  const [hasError, setHasError] = useState(false);
  
  if (!iso2) {
    return <span className="text-base leading-none select-none">🌐</span>;
  }
  
  if (hasError) {
    const emoji = getFlagEmoji(iso2);
    return <span className="text-base leading-none select-none">{emoji || '🌐'}</span>;
  }
  
  const flagUrl = `https://purecatamphetamine.github.io/country-flag-icons/3x2/${iso2.toUpperCase()}.svg`;
  return (
    <img
      src={flagUrl}
      alt={iso2}
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
