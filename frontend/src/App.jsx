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
import DashboardHome from './pages/DashboardHome';
import PsychologistCard from './components/PsychologistCard';
import PsychologistDetailModal from './components/PsychologistDetailModal';

const specialistsDetails = {
  ordinola: {
    nombre: "Dra. Milagros Ordinola Villegas",
    colegiatura: "C.Ps.P. 10245",
    descripcion: "Especialista en psicología clínica con más de 20 años de experiencia en psicoterapia individual para adultos, manejo de trastornos del estado de ánimo, terapia cognitivo-conductual, y evaluaciones neuropsicológicas profundas.",
    atencion: "Lunes a Viernes de 8:00 AM a 2:00 PM. Modalidad Presencial y Virtual. Idiomas: Español.",
    estudios: [
      "Doctorado en Psicología Clínica - Universidad Nacional Mayor de San Marcos",
      "Segunda Especialidad en Neuropsicología - Universidad Peruana Cayetano Heredia",
      "Certificación Internacional en Terapia Cognitivo Conductual"
    ],
    foto: "/Doctora Milagros Ordinola.jpeg"
  },
  karina: {
    nombre: "Lic. Karina Castillo Aguila",
    colegiatura: "C.Ps.P. 14782",
    descripcion: "Especialista en psicoterapia infantil y del adolescente, terapia de lenguaje, y acompañamiento psicoeducativo para padres de familia. Enfoque integrativo centrado en el desarrollo infantil.",
    atencion: "Martes, Jueves y Sábados de 9:00 AM a 5:00 PM. Modalidad Presencial. Idiomas: Español.",
    estudios: [
      "Licenciatura en Psicología - Universidad de San Martín de Porres",
      "Especialidad en Terapia de Lenguaje y Trastornos de la Comunicación",
      "Diplomado en Terapia de Juego e Intervención Infantil"
    ],
    foto: "/Licenciada Karina.jpeg"
  },
  williams: {
    nombre: "Mg. Williams De la Cruz Polo",
    colegiatura: "C.Ps.P. 22314",
    descripcion: "Magíster en psicología de la salud con experiencia en psicoterapia para jóvenes y adultos, intervención en crisis, manejo del estrés, y desarrollo personal. Enfoque humanista y cognitivo-conductual.",
    atencion: "Lunes a Viernes de 2:00 PM a 8:00 PM. Sábados de 8:00 AM a 1:00 PM. Modalidad Presencial y Virtual. Idiomas: Español.",
    estudios: [
      "Licenciatura en Psicología - Universidad Nacional Federico Villarreal",
      "Maestría en Psicología de la Salud - Universidad Peruana Cayetano Heredia",
      "Formación en Terapia de Aceptación y Compromiso (ACT)"
    ],
    foto: "/Magister Williams.jpeg"
  },
  jasmin: {
    nombre: "Lic. Jasmin Pillaca Solis",
    colegiatura: "C.Ps.P. 31205",
    descripcion: "Especialista en terapia de lenguaje, psicomotricidad, y dificultades del aprendizaje en niños en etapa escolar. Dedicada a potenciar las habilidades comunicativas y adaptativas de los niños.",
    atencion: "Miércoles y Viernes de 9:00 AM a 6:00 PM. Modalidad Presencial y Virtual. Idiomas: Español.",
    estudios: [
      "Licenciatura en Psicología - Universidad Peruana Unión",
      "Especialización en Audición, Lenguaje y Aprendizaje",
      "Certificación en Trastornos del Espectro Autista (TEA) y TDAH"
    ],
    foto: "/Licenciada Jasmin Pillaca.jpeg"
  }
};

const getServiceIcon = (nombre) => {
  const name = (nombre || '').toLowerCase();
  if (name.includes('lenguaje')) return 'record_voice_over';
  if (name.includes('neuro') || name.includes('evalu')) return 'psychology';
  if (name.includes('adulto')) return 'person';
  if (name.includes('pareja') || name.includes('familiar')) return 'group';
  if (name.includes('infantil') || name.includes('niño')) return 'child_care';
  return 'healing';
};

// Componente de la Landing Page
const LandingPage = ({ onOpenAuth }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedPsychologist, setSelectedPsychologist] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loadingDB, setLoadingDB] = useState(true);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch services
        const { data: servs, error: servsErr } = await supabase
          .from('servicios')
          .select('*')
          .eq('activo', true);

        if (servsErr) throw servsErr;
        setServices(servs || []);

        // Fetch relationship and employees
        const { data: emps } = await supabase
          .from('empleados')
          .select('*')
          .eq('activo', true);

        const { data: rels } = await supabase
          .from('psicologo_servicio')
          .select('*');

        let formattedEmps = [];

        if (emps && emps.length > 0) {
          formattedEmps = emps.map(emp => {
            const fullName = `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim();
            const lowerName = fullName.toLowerCase();
            
            let detailKey = '';
            if (lowerName.includes('ordinola')) detailKey = 'ordinola';
            else if (lowerName.includes('karina')) detailKey = 'karina';
            else if (lowerName.includes('williams')) detailKey = 'williams';
            else if (lowerName.includes('pillaca') || lowerName.includes('jhasmin')) detailKey = 'jasmin';

            const richDetail = detailKey ? specialistsDetails[detailKey] : null;

            let empServices = [];
            if (rels && servs) {
              const matchedRelIds = rels
                .filter(r => r.psicologo_id === emp.id)
                .map(r => r.servicio_id);
              empServices = servs
                .filter(s => matchedRelIds.includes(s.id))
                .map(s => s.nombre_servicio);
            }

            const specialtyText = empServices.length > 0 
              ? empServices.join(' / ') 
              : (richDetail?.especialidad || emp.rol_sistema || 'Psicólogo(a)');

            return {
              id: emp.id,
              nombre: richDetail?.nombre || fullName,
              especialidad: specialtyText,
              colegiatura: richDetail?.colegiatura || 'C.Ps.P. Disponible',
              descripcion: richDetail?.descripcion || 'Especialista en psicología clínica con enfoque integral.',
              atencion: richDetail?.atencion || 'Horarios a consultar. Modalidad Presencial y Virtual.',
              estudios: richDetail?.estudios || ['Licenciatura en Psicología'],
              foto: richDetail?.foto || null
            };
          });
        }

        if (formattedEmps.length === 0) {
          formattedEmps = Object.values(specialistsDetails).map((detail, index) => ({
            id: `fallback-${index}`,
            ...detail
          }));
        }

        setSpecialists(formattedEmps);
      } catch (err) {
        console.error('Error fetching landing page data:', err);
        setSpecialists(Object.values(specialistsDetails).map((detail, index) => ({
          id: `fallback-${index}`,
          ...detail
        })));
      } finally {
        setLoadingDB(false);
      }
    };

    fetchData();
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
            <a href="#servicios" className="hover:text-[#003178] transition-colors">Servicios Clínicos</a>
            <a href="#specialists" className="hover:text-[#003178] transition-colors">Especialistas</a>
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

        {/* Sección de Servicios Clínicos */}
        <section id="servicios" className="py-28 bg-white text-center">
          <div className="max-w-7xl mx-auto px-6">
            <span className="text-sm font-bold text-[#003178] tracking-widest uppercase">Especialidades</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-2 tracking-tighter uppercase">Nuestros Servicios Clínicos</h2>
            <div className="mx-auto mt-4 h-1.5 w-24 bg-[#6cbdfe] rounded-full mb-20"></div>

            {loadingDB ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-650 font-bold">Cargando servicios...</span>
              </div>
            ) : services.length === 0 ? (
              <p className="text-gray-500 text-lg">Aún no hay servicios disponibles.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {services.map((service) => (
                  <div key={service.id} className="group rounded-3xl bg-[#f9f9fc] border border-gray-100 p-8 text-left hover:shadow-2xl transition-all duration-300">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#003178] group-hover:bg-[#003178] group-hover:text-white transition-all duration-300">
                      <span className="material-symbols-outlined text-[28px]">{getServiceIcon(service.nombre_servicio)}</span>
                    </div>
                    <h3 className="text-xl font-bold text-[#003178] mb-3">{service.nombre_servicio}</h3>
                    {service.precio_sesion && (
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Precio por Sesión</span>
                        <span className="text-lg font-bold text-gray-900">S/ {service.precio_sesion}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sección de Especialistas */}
        <section id="specialists" className="py-28 bg-[#f9f9fc] text-center">
          <div className="max-w-7xl mx-auto px-6">
            <span className="text-sm font-bold text-[#003178] tracking-widest uppercase">Equipo Profesional</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-2 tracking-tighter uppercase">Nuestros Especialistas</h2>
            <div className="mx-auto mt-4 h-1.5 w-24 bg-[#6cbdfe] rounded-full mb-20"></div>

            {loadingDB ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-650 font-bold">Cargando especialistas...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {specialists.map((psico) => (
                  <PsychologistCard
                    key={psico.id}
                    psychologist={psico}
                    onOpenDetails={() => handleOpenDetails(psico)}
                  />
                ))}
              </div>
            )}
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
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/dashboard/appointments" element={<Appointments />} />
        <Route path="/dashboard/book-appointment" element={<BookAppointment />} />
        <Route path="/dashboard/family" element={<Family />} />
        <Route path="/dashboard/documents" element={<Documents />} />
        <Route path="/dashboard/profile" element={<Profile />} />
        <Route path="*" element={<DashboardHome />} />
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