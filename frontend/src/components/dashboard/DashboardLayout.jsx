import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { usePacienteActual } from '../../hooks/usePacienteActual';

const DashboardLayout = ({ children, userName: propUserName, userAvatar: propUserAvatar }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { perfilUsuario } = usePacienteActual();

  const userName = perfilUsuario
    ? `${perfilUsuario.nombres || ''} ${perfilUsuario.apellido_paterno || ''} ${perfilUsuario.apellido_materno || ''}`.trim()
    : (propUserName || 'Paciente');

  const userAvatar = perfilUsuario
    ? `${perfilUsuario.nombres?.charAt(0) || ''}${perfilUsuario.apellido_paterno?.charAt(0) || ''}`.toUpperCase()
    : (propUserAvatar || (userName ? userName.charAt(0).toUpperCase() : 'P'));

  return (
    <div className="flex h-screen overflow-hidden bg-[#f9f9fc] font-['Manrope'] antialiased">
      {/* Sidebar - Escritorio */}
      <Sidebar
        currentPath={location.pathname}
        onNavigate={(path) => navigate(path)}
        onBookAppointment={() => navigate('/dashboard/book-appointment')}
      />

      {/* Sidebar - Móvil (overlay) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <Sidebar
              isMobile={true}
              currentPath={location.pathname}
              onNavigate={(path) => {
                navigate(path);
                setMobileMenuOpen(false);
              }}
              onBookAppointment={() => {
                navigate('/dashboard/book-appointment');
                setMobileMenuOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col md:ml-64 w-full relative min-w-0">
        {/* Barra superior de navegación móvil (oculta en desktop) */}
        <header className="md:hidden bg-white border-b border-slate-100 flex items-center justify-between h-16 px-6 sticky top-0 w-full z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-slate-500 hover:text-[#003178] p-1.5 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <span className="text-lg font-black tracking-tight text-[#003178]">
              CEPSITCED
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#003178] text-white flex items-center justify-center text-xs font-bold shadow-sm">
            {userAvatar}
          </div>
        </header>

        {/* Contenido principal con padding unificado y sin barra horizontal superior blanca en desktop */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 pt-8 pb-12 w-full">
          <div className="max-w-[1280px] w-full mx-auto p-[20px] animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;