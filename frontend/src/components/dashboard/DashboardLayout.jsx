import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const DashboardLayout = ({ children, userName, userAvatar }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[#f9f9fc]">
      {/* Sidebar - Escritorio */}
      <Sidebar
        currentPath={location.pathname}
        onNavigate={(path) => navigate(path)}
        onBookAppointment={() => navigate('/dashboard/book-appointment')}
      />

      {/* Sidebar - Móvil (overlay) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <Sidebar
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
      <div className="flex-1 flex flex-col md:ml-64 w-full relative">
        <TopBar
          userName={userName}
          userAvatar={userAvatar}
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[1200px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;