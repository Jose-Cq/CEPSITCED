import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { cerrarSesion } from '../../utils/supabaseHelpers';

const TopBar = ({ userName = 'Patient', userAvatar, onMenuClick }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    setDropdownOpen(false);
    const confirmar = window.confirm('¿Estás seguro de que deseas cerrar sesión?');
    if (confirmar) {
      await cerrarSesion();
      window.location.href = '/';
    }
  };

  // Cerrar el menú desplegable al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Cerrar el menú al cambiar de ruta
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  return (
    <header className="bg-white/90 backdrop-blur-md border-b z-50 border-slate-100 shadow-sm flex justify-between items-center h-16 px-8 sticky top-0 w-full">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden text-slate-500 hover:text-[#003178] transition-colors duration-200"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="md:hidden text-xl font-extrabold tracking-tight text-[#003178]">
          CEPSITCED
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 ml-auto">
        {/* User Avatar & Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 ml-2 cursor-pointer focus:outline-none rounded-full"
            aria-label="User profile menu"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <div className="w-8 h-8 rounded-full bg-[#003178] text-white flex items-center justify-center text-sm font-bold hover:bg-blue-900 transition-colors">
              {userAvatar || userName.charAt(0).toUpperCase()}
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuario</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5 break-words">{userName}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;