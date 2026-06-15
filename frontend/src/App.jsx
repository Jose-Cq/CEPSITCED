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
import PsychologistDetailModal from './components/PsychologistDetailModal';
import { PacienteProvider } from './hooks/usePacienteActual';

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
  const [selectedPsychologist, setSelectedPsychologist] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [slides, setSlides] = useState([]);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testimonios, setTestimonios] = useState([]);
  const [faqs, setFaqs] = useState([]);

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

  const handleOpenDetails = (psychologist) => {
    setSelectedPsychologist(psychologist);
    setIsDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f9f9fc] font-['Manrope'] antialiased">
      <header className="fixed top-0 z-[100] w-full border-b bg-white/95 backdrop-blur-md px-6 shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between text-[#003178]">
          <div className="flex items-center gap-3">
            <img src="/logo-cepsitced.png" alt="Logo CEPSITCED" className="h-10 w-10 object-contain" />
            <span className="text-2xl font-black tracking-tighter uppercase">CEPSITCED</span>
          </div>
          <nav className="hidden lg:flex items-center gap-6 font-bold text-xs text-gray-550 uppercase tracking-widest">
            <a href="#inicio" className="hover:text-[#003178] transition-colors text-[#003178]">Inicio</a>
            <a href="#nosotros" className="hover:text-[#003178] transition-colors">Nosotros</a>
            <a href="#servicios" className="hover:text-[#003178] transition-colors">Servicios</a>
            <a href="#specialists" className="hover:text-[#003178] transition-colors">Especialistas</a>
            {testimonios.length > 0 && (
              <a href="#testimonios" className="hover:text-[#003178] transition-colors">Testimonios</a>
            )}
            <a href="#faq" className="hover:text-[#003178] transition-colors">FAQ</a>
          </nav>
          <button
            onClick={onOpenAuth}
            className="px-6 py-2.5 bg-[#003178] text-white font-bold rounded-xl shadow-lg hover:bg-blue-900 transition-all text-sm uppercase tracking-wider cursor-pointer"
          >
            Portal Pacientes
          </button>
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
          onOpenDetails={handleOpenDetails}
          onOpenAuth={onOpenAuth}
        />

        {/* Sección de Testimonios */}
        <TestimonialsCarousel testimonios={testimonios} />

        {/* Sección de Preguntas Frecuentes */}
        <FaqSection faqs={faqs} />
      </main>


      {/* Modal de Detalle */}
      <PsychologistDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        psychologist={selectedPsychologist}
      />

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
  const isAuthOpen = location.pathname === '/login';
  const isRegisterOpen = location.pathname === '/register';

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
        {/* Si intenta acceder al dashboard sin sesión, redirige a /login */}
        <Route path="/dashboard/*" element={<Navigate to="/login" replace />} />
        {/* Redirección para cualquier otra ruta desconocida */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;