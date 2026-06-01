import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import AuthModal from './components/AuthModal';
import RegisterModal from './components/RegisterModal';
import Appointments from './pages/Appointments';
import BookAppointment from './pages/BookAppointment';
import Family from './pages/Family';
import Documents from './pages/Documents';
import Profile from './pages/Profile';
import PsychologistCard from './components/PsychologistCard';
import PsychologistDetailModal from './components/PsychologistDetailModal';

const psicologas = [
  {
    id: 1,
    nombre: "Dra. Valeria Alarcón Prado",
    especialidad: "Terapia Cognitivo-Conductual (TCC) e Infantil",
    descripcion: "Psicóloga clínica con más de 8 años de experiencia acompañando a niños, adolescentes y familias en procesos terapéuticos, manejo de ansiedad, TDAH, y regulación emocional. Especialista en enfoques basados en la evidencia y desarrollo integral del menor.",
    atencion: "Lunes a Viernes de 9:00 AM a 6:00 PM. Modalidad Presencial y Virtual. Idiomas: Español e Inglés.",
    foto: "/dr_valeria.png",
    colegiatura: "C.Ps.P. 24890",
    estudios: [
      "Licenciatura en Psicología - Universidad Nacional Mayor de San Marcos",
      "Especialidad en Psicoterapia Cognitivo Conductual - ALAPCO",
      "Diplomado en Intervención y Diagnóstico del TDAH y TEA - Universidad Cayetano Heredia"
    ]
  },
  {
    id: 2,
    nombre: "Mg. Beatríz Morales Valdivia",
    especialidad: "Terapia de Pareja y Familiar",
    descripcion: "Magíster en Terapia Familiar Sistémica con amplia trayectoria en resolución de conflictos, comunicación asertiva, duelo, y crisis familiares o de pareja. Apasionada por construir puentes de empatía y reconstruir vínculos afectivos saludables.",
    atencion: "Martes y Jueves de 1:00 PM a 8:00 PM. Sábados de 9:00 AM a 1:00 PM. Modalidad Virtual. Idiomas: Español.",
    foto: "/mg_beatriz.png",
    colegiatura: "C.Ps.P. 18355",
    estudios: [
      "Licenciatura en Psicología - Pontificia Universidad Católica del Perú",
      "Maestría en Terapia Familiar y de Pareja - Universidad Autónoma de Barcelona",
      "Certificación Internacional en Disciplina Positiva"
    ]
  },
  {
    id: 3,
    nombre: "Lic. Camila Restrepo Gómez",
    especialidad: "Terapia de Adultos y Neuropsicología",
    descripcion: "Especialista en evaluación cognitiva, trastornos del estado de ánimo (depresión, estrés crónico, trastorno obsesivo-compulsivo) y rehabilitación neuropsicológica en adultos jóvenes y adultos mayores. Enfoque centrado en la persona.",
    atencion: "Miércoles y Sábados de 8:00 AM a 5:00 PM. Modalidad Presencial y Virtual. Idiomas: Español.",
    foto: "/lic_camila.png",
    colegiatura: "C.Ps.P. 31042",
    estudios: [
      "Licenciatura en Psicología Clínica - Universidad de Lima",
      "Segunda Especialidad en Neuropsicología - Universidad Peruana Cayetano Heredia",
      "Curso Avanzado de Mindfulness y Reducción del Estrés (MBSR)"
    ]
  }
];

// Componente de la Landing Page
const LandingPage = ({ onOpenAuth }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedPsychologist, setSelectedPsychologist] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const slides = [
    {
      url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2000",
      title: "Salud mental con precisión clínica",
      subtitle: "Entorno seguro diseñado para tu bienestar emocional."
    },
    {
      url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=2000",
      title: "Especialistas en Terapia Cognitiva",
      subtitle: "Staff multidisciplinario para todas las edades."
    }
  ];

  useEffect(() => {
    const timer = setInterval(() =>
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1)),
      6000
    );
    return () => clearInterval(timer);
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
            <div className="h-10 w-10 rounded-lg bg-[#003178] flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase">CEPSITCED</span>
          </div>
          <nav className="hidden lg:flex items-center gap-8 font-bold text-xs text-gray-500 uppercase tracking-widest">
            <a href="#inicio" className="text-[#003178]">Inicio</a>
            <a href="#nosotros" className="hover:text-[#003178] transition-colors">Nosotros</a>
            <a href="#psicologas" className="hover:text-[#003178] transition-colors">Nuestras Psicólogas</a>
          </nav>
          <button
            onClick={onOpenAuth}
            className="px-6 py-2.5 bg-[#003178] text-white font-bold rounded-xl shadow-lg hover:bg-blue-900 transition-all text-sm uppercase tracking-wider"
          >
            Portal Pacientes
          </button>
        </div>
      </header>

      <main className="pt-20">
        <section id="inicio" className="relative h-[680px] w-full bg-gray-950 overflow-hidden">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100 z-10" : "opacity-0"}`}
            >
              <img src={slide.url} className="h-full w-full object-cover brightness-50" alt="fondo" />
              <div className="absolute inset-0 flex items-center px-8 max-w-7xl mx-auto text-white">
                <div className="max-w-3xl">
                  <h1 className="text-5xl md:text-7xl font-extrabold mb-6 uppercase tracking-tighter">{slide.title}</h1>
                  <p className="text-xl mb-12 font-medium leading-relaxed">{slide.subtitle}</p>
                  <button
                    onClick={onOpenAuth}
                    className="rounded-2xl bg-[#6cbdfe] px-12 py-4 font-extrabold text-[#001d32] hover:bg-white transition-all transform hover:scale-105 pointer-events-auto"
                  >
                    Agendar Cita Ahora
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section id="nosotros" className="py-28 bg-white text-center uppercase">
          <span className="text-sm font-bold text-[#003178] tracking-widest">Nuestros Pilares</span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-2 tracking-tighter">Nuestro Propósito</h2>
          <div className="mx-auto mt-4 h-1.5 w-24 bg-[#6cbdfe] rounded-full mb-20"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-7xl mx-auto px-6">
            {[
              { t: 'Misión', i: '🚩', d: 'La misión del centro CEPSITCED es ofrecer y brindar servicios psicológicos dirigido a estudiantes, instituciones y comunidades promoviendo la salud mental en nuestra sociedad, ofreciendo una amplia gama de servicios. Buscando así, que cada estudiante de psicología, asuma con responsabilidad y determinación el mejorar la salud mental de los pacientes en todas las áreas..' },
              { t: 'Visión', i: '👁️', d: 'La visión del centro CEPSITCED tiene como objetivo ser una de las principales instituciones, destacado y reconocida en el ámbito de la salud y apoyar instituciones educativas en el abordaje de la salud mental en promotion, prevención e intervención..' },
              { t: 'Valores', i: '🧠', d: 'Empatía profesional, confidencialidad y ética constante.' }
            ].map((card, idx) => (
              <div key={idx} className="group rounded-3xl bg-[#f9f9fc] border border-gray-100 p-10 text-left hover:shadow-2xl transition-all">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-4xl group-hover:bg-[#003178] transition-all">
                  {card.i}
                </div>
                <h3 className="text-2xl font-bold text-[#003178] mb-5 uppercase">{card.t}</h3>
                <p className="text-gray-600 text-lg leading-relaxed lowercase first-letter:uppercase">{card.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sección de Psicólogas */}
        <section id="psicologas" className="py-28 bg-[#f9f9fc] text-center">
          <div className="max-w-7xl mx-auto px-6">
            <span className="text-sm font-bold text-[#003178] tracking-widest uppercase">Staff Profesional</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-2 tracking-tighter uppercase">Nuestras Psicólogas</h2>
            <div className="mx-auto mt-4 h-1.5 w-24 bg-[#6cbdfe] rounded-full mb-20"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {psicologas.map((psico) => (
                <PsychologistCard
                  key={psico.id}
                  psychologist={psico}
                  onOpenDetails={() => handleOpenDetails(psico)}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Modal de Detalle */}
      <PsychologistDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        psychologist={selectedPsychologist}
      />
    </div>
  );
};

// Componente principal con enrutamiento y autenticación
const App = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  // Manejar inicio de sesión exitoso
  const handleLoginSuccess = () => {
    setIsAuthOpen(false);
    navigate('/dashboard/appointments');
  };

  // Mostrar pantalla de carga mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9f9fc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#003178] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si hay sesión, mostrar dashboard
  if (session) {
    return (
      <Routes>
        <Route path="/dashboard/appointments" element={<Appointments />} />
        <Route path="/dashboard/book-appointment" element={<BookAppointment />} />
        <Route path="/dashboard/family" element={<Family />} />
        <Route path="/dashboard/documents" element={<Documents />} />
        <Route path="/dashboard/profile" element={<Profile />} />
        <Route path="*" element={<Appointments />} />
      </Routes>
    );
  }

  // Si no hay sesión, mostrar landing page
  return (
    <>
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onOpenRegister={() => {
          setIsAuthOpen(false);
          setIsRegisterOpen(true);
        }}
        onLoginSuccess={handleLoginSuccess}
      />
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />
      <Routes>
        <Route path="*" element={<LandingPage onOpenAuth={() => setIsAuthOpen(true)} />} />
      </Routes>
    </>
  );
};

export default App;