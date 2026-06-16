import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import AuthModal from './components/AuthModal';
import RegisterModal from './components/RegisterModal';
import Appointments from './pages/Appointments';
import BookAppointment from './pages/BookAppointment';
import Family from './pages/Family';
import Documents from './pages/Documents';
import Profile from './pages/Profile';
import DashboardHome from './pages/DashboardHome';
import { PacienteProvider } from './hooks/usePacienteActual';
import ResetPassword from './pages/ResetPassword';
import Independizarse from './pages/Independizarse';

// Backend Services & Components
import HeroCarousel from './components/HeroCarousel';
import MissionVisionSection from './components/MissionVisionSection';
import ServicesCarousel from './components/ServicesCarousel';
import SpecialistsCarousel from './components/SpecialistsCarousel';
import TestimonialsCarousel from './components/TestimonialsCarousel';
import FaqSection from './components/FaqSection';
import Footer from './components/Footer';
import { obtenerCarruselLanding, obtenerConfiguracionLanding, obtenerTestimoniosLanding, obtenerFaqsLanding } from '@backend/services/landingService.js';

const fallbackSlides = [
  {
    titulo: 'Atención psicológica especializada',
    subtitulo: 'Cuidado clínico para niños, adolescentes, adultos y familias.',
    descripcion: 'Agenda tu sesión y recibe acompañamiento profesional en un espacio seguro y humano.',
    imagen_url: null,
    boton_texto: 'Agendar cita',
    boton_accion: 'abrir_portal'
  }
];

// Componente de la Landing Page
const LandingPage = ({ onOpenAuth }) => {
  const [slides, setSlides] = useState([]);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testimonios, setTestimonios] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const carouselData = await obtenerCarruselLanding();
        setSlides(carouselData.length > 0 ? carouselData : fallbackSlides);
      } catch (err) {
        console.error('Error fetching carousel data:', err);
        setSlides(fallbackSlides);
      } finally {
        setLoadingSlides(false);
      }

      try {
        const configData = await obtenerConfiguracionLanding();
        setConfig(configData);
      } catch (err) {
        console.error('Error fetching config data:', err);
      } finally {
        setLoadingConfig(false);
      }

      try {
        const testimoniosData = await obtenerTestimoniosLanding();
        setTestimonios(testimoniosData || []);
      } catch (err) {
        console.error('Error fetching testimonials:', err);
      }

      try {
        const faqsData = await obtenerFaqsLanding();
        setFaqs(faqsData || []);
      } catch (err) {
        console.error('Error fetching FAQs:', err);
      }
    };

    fetchLandingData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);


  return (
    <div className="min-h-screen bg-[#f9f9fc] font-['Manrope'] antialiased">
      <header className="fixed top-0 z-[100] w-full border-b bg-white/95 backdrop-blur-md px-4 sm:px-6 shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between text-[#003178]">
          <a
            href="#inicio"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-2 sm:gap-3 select-none hover:opacity-90 transition-opacity cursor-pointer text-[#003178] no-underline"
          >
            <img src="/logo-cepsitced.png" alt="Logo CEPSITCED" className="h-8 w-8 sm:h-10 sm:w-10 object-contain" />
            <span className="text-xl sm:text-2xl font-black tracking-tighter uppercase">CEPSITCED</span>
          </a>

          {/* Desktop Navigation Link Menu (visible only >= 1040px) */}
          <nav className="nav-desktop-only items-center gap-6 font-bold text-xs text-gray-550 uppercase tracking-widest">
            <a href="#inicio" className="hover:text-[#003178] transition-colors text-[#003178]">Inicio</a>
            <a href="#nosotros" className="hover:text-[#003178] transition-colors">Nosotros</a>
            <a href="#servicios" className="hover:text-[#003178] transition-colors">Servicios</a>
            <a href="#specialists" className="hover:text-[#003178] transition-colors">Especialistas</a>
            {testimonios.length > 0 && (
              <a href="#testimonios" className="hover:text-[#003178] transition-colors">Testimonios</a>
            )}
            <a href="#faq" className="hover:text-[#003178] transition-colors">FAQ</a>
          </nav>

          {/* Desktop Portal Pacientes Button (visible only >= 1040px) */}
          <button
            onClick={onOpenAuth}
            className="nav-desktop-only px-6 py-2.5 bg-[#003178] text-white font-bold rounded-xl shadow-lg hover:bg-blue-900 transition-all text-sm uppercase tracking-wider cursor-pointer"
          >
            Portal Pacientes
          </button>

          {/* Mobile Hamburger Toggle Button (visible only < 1040px) */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="nav-mobile-only p-2 text-[#003178] hover:bg-slate-100 rounded-xl transition-all cursor-pointer select-none"
            aria-label={isMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
            aria-expanded={isMenuOpen}
          >
            <span className="material-symbols-outlined text-[28px] leading-none block">
              {isMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

        {/* Mobile Drawer Backdrop Overlay (visible only < 1040px) */}
        <div
          className={`nav-mobile-only fixed inset-0 bg-black/30 z-[90] transition-opacity duration-300 ${
            isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsMenuOpen(false)}
        />

        {/* Mobile Drawer Sidebar (visible only < 1040px) */}
        <div
          className={`nav-mobile-only fixed top-0 right-0 h-screen bg-white z-[100] shadow-2xl flex flex-col p-6 gap-6 transition-transform duration-300 ease-out w-[50vw] max-[430px]:w-[85vw] max-w-[420px] ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header of Drawer: Close Button */}
          <div className="flex items-center justify-between border-b pb-4">
            <span className="text-lg font-black text-[#003178] uppercase tracking-tighter">Menú</span>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-2 text-[#003178] hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              aria-label="Cerrar menú de navegación"
            >
              <span className="material-symbols-outlined text-[28px] leading-none block">close</span>
            </button>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-4 font-bold text-sm text-[#003178] uppercase tracking-wider overflow-y-auto flex-grow">
            <a
              href="#inicio"
              onClick={() => setIsMenuOpen(false)}
              className="hover:bg-slate-50 p-2.5 rounded-xl transition-all"
            >
              Inicio
            </a>
            <a
              href="#nosotros"
              onClick={() => setIsMenuOpen(false)}
              className="hover:bg-slate-50 p-2.5 rounded-xl transition-all"
            >
              Nosotros
            </a>
            <a
              href="#servicios"
              onClick={() => setIsMenuOpen(false)}
              className="hover:bg-slate-50 p-2.5 rounded-xl transition-all"
            >
              Servicios
            </a>
            <a
              href="#specialists"
              onClick={() => setIsMenuOpen(false)}
              className="hover:bg-slate-50 p-2.5 rounded-xl transition-all"
            >
              Especialistas
            </a>
            {testimonios.length > 0 && (
              <a
                href="#testimonios"
                onClick={() => setIsMenuOpen(false)}
                className="hover:bg-slate-50 p-2.5 rounded-xl transition-all"
              >
                Testimonios
              </a>
            )}
            <a
              href="#faq"
              onClick={() => setIsMenuOpen(false)}
              className="hover:bg-slate-50 p-2.5 rounded-xl transition-all"
            >
              FAQ
            </a>
          </div>

          {/* Pacientes Button */}
          <div className="border-t pt-4">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onOpenAuth();
              }}
              className="w-full text-center bg-[#003178] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg hover:bg-blue-900 transition-all text-xs sm:text-sm uppercase tracking-widest cursor-pointer whitespace-nowrap"
            >
              Portal Pacientes
            </button>
          </div>
        </div>
      </header>

      <main className="pt-20">
        {/* Hero Slider */}
        <HeroCarousel
          slides={slides}
          loading={loadingSlides}
          onOpenAuth={onOpenAuth}
        />

        {/* Sección Nuestro Propósito */}
        <MissionVisionSection
          config={config}
          loading={loadingConfig}
        />

        {/* Sección de Servicios Clínicos */}
        <ServicesCarousel
          onOpenAuth={onOpenAuth}
        />

        {/* Sección de Especialistas */}
        <SpecialistsCarousel
          onOpenAuth={onOpenAuth}
        />

        {/* Sección de Testimonios */}
        <TestimonialsCarousel testimonios={testimonios} />

        {/* Sección de Preguntas Frecuentes */}
        <FaqSection faqs={faqs} />
      </main>



      {/* Footer */}
      <Footer />
    </div>
  );
};

// Componente principal con enrutamiento y autenticación
const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthOpen = location.pathname === '/login';
  const isRegisterOpen = location.pathname === '/register';

  useEffect(() => {
    if (isAuthOpen || isRegisterOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAuthOpen, isRegisterOpen]);

  // Verificar sesión al cargar
  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Mostrar pantalla de carga mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9f9fc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#003178] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-550">Cargando...</p>
        </div>
      </div>
    );
  }

  const isLoggedIn = session && sessionStorage.getItem('is_registering') !== 'true';

  // Si está logueado, protegemos las rutas con PacienteProvider
  if (isLoggedIn) {
    return (
      <PacienteProvider>
        <Routes>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/appointments" element={<Appointments />} />
          <Route path="/dashboard/book-appointment" element={<BookAppointment />} />
          <Route path="/dashboard/family" element={<Family />} />
          <Route path="/dashboard/documents" element={<Documents />} />
          <Route path="/dashboard/profile" element={<Profile />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/independizarse" element={<Independizarse />} />
          {/* Redirecciones para rutas públicas y desconocidas cuando el usuario ya está autenticado */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/register" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </PacienteProvider>
    );
  }

  // Si NO está logueado, las modales se manejan en base a la URL:

  const handleCloseAuth = () => {
    navigate('/');
  };

  const handleCloseRegister = () => {
    navigate('/');
  };

  const handleOpenRegister = () => {
    navigate('/register');
  };

  const handleOpenAuth = () => {
    navigate('/login');
  };

  const handleLoginSuccess = () => {
    navigate('/dashboard');
  };

  return (
    <>
      <AuthModal
        isOpen={isAuthOpen}
        onClose={handleCloseAuth}
        onOpenRegister={handleOpenRegister}
        onLoginSuccess={handleLoginSuccess}
      />
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={handleCloseRegister}
      />
      <Routes>
        {/* Rutas públicas disponibles cuando no hay sesión */}
        <Route path="/" element={<LandingPage onOpenAuth={handleOpenAuth} />} />
        <Route path="/login" element={<LandingPage onOpenAuth={handleOpenAuth} />} />
        <Route path="/register" element={<LandingPage onOpenAuth={handleOpenAuth} />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/independizarse" element={<Independizarse />} />
        {/* Si intenta acceder al dashboard sin sesión, redirige a /login */}
        <Route path="/dashboard/*" element={<Navigate to="/login" replace />} />
        {/* Redirección para cualquier otra ruta desconocida */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;