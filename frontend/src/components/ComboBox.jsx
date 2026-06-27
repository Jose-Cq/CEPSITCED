import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const ComboBox = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccione...',
  searchable = false,
  required = false,
  disabled = false,
  className = '',
  id,
  dropdownWidth
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef(null);
  const [coords, setCoords] = useState(null);

  const selectedOption = options.find(opt => {
    if (typeof opt === 'object') {
      return opt.value === value;
    }
    return opt === value;
  });

  const getOptionLabel = (opt) => {
    if (!opt) return '';
    return typeof opt === 'object' ? opt.label : opt;
  };

  const getOptionValue = (opt) => {
    if (!opt) return '';
    return typeof opt === 'object' ? opt.value : opt;
  };

  const filteredOptions = searchable && search.trim() !== ''
    ? options.filter(opt => {
        if (typeof opt === 'object') {
          const label = opt.label.toLowerCase();
          const searchKey = opt.searchKey ? opt.searchKey.toLowerCase() : '';
          return label.includes(search.toLowerCase()) || searchKey.includes(search.toLowerCase());
        }
        return opt.toLowerCase().includes(search.toLowerCase());
      })
    : options;

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const windowWidth = window.innerWidth;
      const maxDropdownW = dropdownWidth ? parseInt(dropdownWidth) : 360;
      const estimatedWidth = Math.max(rect.width, Math.min(maxDropdownW, windowWidth * 0.9));
      
      let left = rect.left + scrollX;
      if (rect.left + estimatedWidth > windowWidth) {
        left = windowWidth - estimatedWidth - 16 + scrollX;
      }
      if (left < scrollX + 10) {
        left = scrollX + 10;
      }

      setCoords({
        top: rect.bottom + scrollY,
        left,
        width: rect.width
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSearch('');
      setCoords(null);
    }
  };

  const handleSelect = (opt) => {
    onChange(getOptionValue(opt));
    setIsOpen(false);
    setSearch('');
    setCoords(null);
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isOpen]);

  return (
    <div className={`relative w-full ${isOpen ? 'z-[50]' : 'z-10'} ${className}`} id={id}>
      <div
        ref={triggerRef}
        onClick={handleToggle}
        className={`w-full px-4 bg-gray-50 border rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] h-[54px] flex items-center justify-between cursor-pointer select-none ${
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-400 border-gray-200' : 'border-gray-200 hover:border-gray-300'
        } ${isOpen ? 'border-[#003178] ring-1 ring-[#003178]/10' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              {typeof selectedOption === 'object' && selectedOption.flag && (
                <span className="inline-flex items-center shrink-0">
                  {selectedOption.flag}
                </span>
              )}
              <span className="truncate">{getOptionLabel(selectedOption)}</span>
            </>
          ) : (
            <span className="text-gray-400 font-normal">{placeholder}</span>
          )}
        </div>
        <span className="material-symbols-outlined text-gray-400 select-none">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </div>

      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          className="absolute inset-x-0 bottom-0 h-0 opacity-0 pointer-events-none"
        />
      )}

      {isOpen && coords && createPortal(
        <>
          <div className="fixed inset-0 z-[99998]" onClick={() => { setIsOpen(false); setSearch(''); setCoords(null); }} />
          <div
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              minWidth: dropdownWidth ? undefined : `${coords.width}px`,
              width: dropdownWidth || 'max-content',
              maxWidth: dropdownWidth ? `min(${dropdownWidth}, 90vw)` : 'min(360px, 90vw)'
            }}
            className="bg-white border border-gray-200 rounded-2xl shadow-xl z-[99999] overflow-hidden flex flex-col max-h-64 transition-none animate-none"
          >
            {searchable && (
              <div className="p-2 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400 text-lg ml-2 select-none">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-transparent outline-none text-sm text-gray-770 py-1"
                  autoFocus
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-650 px-1">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>
            )}
            <div className="overflow-y-auto flex-1 py-1 max-h-48">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => {
                  const optVal = getOptionValue(opt);
                  const optLabel = getOptionLabel(opt);
                  const isSelected = optVal === value;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelect(opt)}
                      className={`px-4 py-3 hover:bg-gray-50 text-sm cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-blue-50/50 text-[#003178] font-bold' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        {typeof opt === 'object' && opt.flag && (
                          <span className="inline-flex items-center shrink-0">
                            {opt.flag}
                          </span>
                        )}
                        <span className="whitespace-normal break-words">{optLabel}</span>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[#003178] text-base shrink-0 select-none">check</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-xs text-gray-450 text-center">No se encontraron resultados</div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ComboBox;
