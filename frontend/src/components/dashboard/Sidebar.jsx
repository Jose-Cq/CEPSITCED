import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cerrarSesion } from '../../utils/supabaseHelpers';

const menuItems = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'appointments', icon: 'calendar_today', label: 'Mis Citas', path: '/dashboard/appointments' },
  { id: 'documents', icon: 'description', label: 'Documentos', path: '/dashboard/documents' },
  { id: 'family', icon: 'groups', label: 'Perfiles', path: '/dashboard/family' },
  { id: 'profile', icon: 'account_circle', label: 'Perfil', path: '/dashboard/profile' },
];

const bottomItems = [
  { id: 'settings', icon: 'settings', label: 'Configuración', path: '/dashboard/settings' },
  { id: 'logout', icon: 'logout', label: 'Cerrar Sesión', path: '/logout' },
];

const Sidebar = ({ currentPath, onNavigate, onBookAppointment }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentRoute = currentPath || location.pathname;

  const isActive = (path) => {
    if (path === '/dashboard' && currentRoute === '/dashboard') return true;
    if (path !== '/dashboard' && currentRoute.startsWith(path)) return true;
    return false;
  };

  const handleNavigation = (path) => {
    if (path === '/logout') {
      // Manejar cierre de sesión
      handleLogout();
    } else if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  const handleLogout = async () => {
    const confirmar = window.confirm('¿Estás seguro de que deseas cerrar sesión?');
    if (confirmar) {
      await cerrarSesion();
      // Redirigir a la landing page
      window.location.href = '/';
    }
  };

  const handleBookAppointment = () => {
    if (onBookAppointment) {
      onBookAppointment();
    } else {
      navigate('/dashboard/book-appointment');
    }
  };

  return (
    <aside className="bg-white font-['Manrope'] text-sm font-medium fixed left-0 top-0 h-full w-64 border-r border-slate-100 flex flex-col py-6 z-40 hidden md:flex">
      {/* Header */}
      <div className="px-6 pb-8 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#003178] flex items-center justify-center text-white font-bold">
            C
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#003178]">CEPSITCED</h1>
            <p className="text-slate-500 text-xs">Portal Clínico</p>
          </div>
        </div>
      </div>

      {/* Botón CTA */}
      <div className="px-4 mb-6">
        <button
          onClick={handleBookAppointment}
          className="w-full bg-[#003178] text-white rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-900 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Agendar Cita
        </button>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.path)}
            className={`w-full flex items-center px-4 py-3 my-1 rounded-lg transition-all duration-150 text-left ${isActive(item.path)
                ? 'bg-blue-50 text-[#003178] border-r-4 border-[#003178] font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <span
              className="material-symbols-outlined mr-3 text-[20px]"
              style={{ fontVariationSettings: isActive(item.path) ? "'FILL' 1" : "'FILL' 0" }}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Navegación inferior */}
      <div className="px-2 mt-auto pt-4 border-t border-slate-100">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.path)}
            className={`w-full flex items-center px-4 py-3 my-1 rounded-lg transition-all duration-150 text-left ${item.id === 'logout'
                ? 'text-red-500 hover:bg-red-50 hover:text-red-700'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <span className="material-symbols-outlined mr-3 text-[20px]">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;