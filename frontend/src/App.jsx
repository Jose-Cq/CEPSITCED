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

// Validar si la URL de la imagen es válida y no es nula o vacía
const hasValidImage = (url) => {
  if (url === null || url === undefined) return false;
  const cleanUrl = String(url).trim();
  return cleanUrl !== '' && cleanUrl !== 'null' && cleanUrl !== 'undefined';
};

// Componente de la Landing Page
const LandingPage = ({ onOpenAuth }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedPsychologist, setSelectedPsychologist] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loadingDB, setLoadingDB] = useState(true);
  const navigate = useNavigate();

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

  const fallbackPurpose = {
    titulo: "Nuestro Propósito",
    subtitulo: "Acompañar cada proceso con calidez, ética y precisión clínica.",
    descripcion: "La misión del centro CEPSITCED es ofrecer y brindar servicios psicológicos dirigidos a estudiantes, instituciones y comunidades promoviendo la salud mental en nuestra sociedad. Buscamos que cada persona asuma con determinación el mejorar su salud mental y bienestar emocional en todas las áreas de su vida."
  };

  const fallbackPurposeItems = [
    {
      titulo: 'Atención especializada',
      descripcion: 'Psicoterapia individual, infantil, de pareja y familiar adaptada a tus necesidades específicas.',
      icono: 'clinical_notes'
    },
    {
      titulo: 'Acompañamiento emocional',
      descripcion: 'Apoyo continuo y cálido en cada etapa de tu proceso de crecimiento personal.',
      icono: 'favorite'
    },
    {
      titulo: 'Evaluación y seguimiento',
      descripcion: 'Evaluaciones psicológicas exhaustivas y seguimiento clínico constante de tu evolución.',
      icono: 'analytics'
    },
    {
      titulo: 'Enfoque familiar',
      descripcion: 'Integración y participación activa de la familia para potenciar los resultados de la terapia.',
      icono: 'family_history'
    }
  ];

  const [slides, setSlides] = useState([]);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const [purpose, setPurpose] = useState(fallbackPurpose);
  const [purposeItems, setPurposeItems] = useState(fallbackPurposeItems);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() =>
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1)),
      6000
    );
    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Carousel Slides
        const { data: carouselData, error: carouselError } = await supabase
          .from('landing_carousel')
          .select('*')
          .eq('activo', true)
          .order('orden', { ascending: true });

        if (!carouselError && carouselData && carouselData.length > 0) {
          setSlides(carouselData);
        } else {
          setSlides(fallbackSlides);
        }
        setLoadingSlides(false);

        // 2. Fetch Purpose main section metadata
        const { data: purposeData, error: purposeError } = await supabase
          .from('landing_proposito')
          .select('*')
          .eq('activo', true)
          .limit(1)
          .maybeSingle();

        if (!purposeError && purposeData) {
          setPurpose(purposeData);
        } else {
          setPurpose(fallbackPurpose);
        }

        // 3. Fetch Purpose Items
        const { data: purposeItemsData, error: purposeItemsError } = await supabase
          .from('landing_proposito_items')
          .select('*')
          .eq('activo', true)
          .order('orden', { ascending: true });

        if (!purposeItemsError && purposeItemsData && purposeItemsData.length > 0) {
          setPurposeItems(purposeItemsData);
        } else {
          setPurposeItems(fallbackPurposeItems);
        }

        // 4. Fetch services
        const { data: servs, error: servsErr } = await supabase
          .from('servicios')
          .select('*')
          .eq('activo', true)
          .eq('mostrar_landing', true);

        if (!servsErr && servs) {
          let sortedServs = [...servs];
          sortedServs.sort((a, b) => {
            if (a.orden !== null && a.orden !== undefined && b.orden !== null && b.orden !== undefined) {
              return a.orden - b.orden;
            }
            if (a.orden !== null && a.orden !== undefined) return -1;
            if (b.orden !== null && b.orden !== undefined) return 1;
            return (a.nombre_servicio || '').localeCompare(b.nombre_servicio || '');
          });
          setServices(sortedServs);
        } else {
          setServices([]);
        }

        // 5. Fetch relationship and employees for specialists
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
        setSlides(fallbackSlides);
        setLoadingSlides(false);
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

  const handleButtonAction = (accion) => {
    if (!accion) return;
    if (accion === 'abrir_portal' || accion === '/auth') {
      onOpenAuth();
    } else if (accion.startsWith('#')) {
      const el = document.querySelector(accion);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (accion.startsWith('http')) {
      window.open(accion, '_blank');
    } else {
      navigate(accion);
    }
  };

  const getServiceFallbackIcon = (nombre) => {
    const name = (nombre || '').toLowerCase();
    if (name.includes('lenguaje')) return 'record_voice_over';
    if (name.includes('neuro') || name.includes('evalu')) return 'psychology';
    if (name.includes('adulto')) return 'person';
    if (name.includes('pareja') || name.includes('familiar')) return 'group';
    if (name.includes('infantil') || name.includes('niño')) return 'child_care';
    return 'healing';
  };

  const getServiceFallbackDesc = (nombre) => {
    const name = (nombre || '').toLowerCase();
    if (name.includes('lenguaje')) {
      return 'Evaluación y terapia para dificultades del habla, pronunciación y desarrollo del lenguaje en niños y adultos.';
    }
    if (name.includes('neuro') || name.includes('evalu')) {
      return 'Evaluación diagnóstica integral de las funciones cognitivas, conductuales y emocionales.';
    }
    if (name.includes('adulto')) {
      return 'Psicoterapia individual orientada a jóvenes y adultos para el manejo de ansiedad, depresión, estrés y desarrollo personal.';
    }
    return 'Servicio de atención y acompañamiento psicológico especializado.';
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
          <nav className="hidden lg:flex items-center gap-8 font-bold text-xs text-gray-550 uppercase tracking-widest">
            <a href="#inicio" className="text-[#003178]">Inicio</a>
            <a href="#nosotros" className="hover:text-[#003178] transition-colors">Nosotros</a>
            <a href="#servicios" className="hover:text-[#003178] transition-colors">Servicios Clínicos</a>
            <a href="#specialists" className="hover:text-[#003178] transition-colors">Especialistas</a>
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
        <section id="inicio" className="relative h-[680px] w-full bg-gray-950 overflow-hidden">
          {loadingSlides ? (
            <div className="absolute inset-0 bg-gradient-to-br from-[#000d1a] via-[#00224d] to-[#000d1a] overflow-hidden">
              {/* Resplandores suaves / Ambient glow */}
              <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/15 blur-[120px]" />
              <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-[#6cbdfe]/10 blur-[130px]" />
              <div className="absolute top-[30%] left-[35%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]" />
            </div>
          ) : (
            slides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100 z-10" : "opacity-0"}`}
              >
                {hasValidImage(slide.imagen_url) ? (
                  <img src={slide.imagen_url} className="h-full w-full object-cover brightness-40 scale-105 transition-transform duration-10000" alt="Fondo Hero" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#000d1a] via-[#00224d] to-[#000d1a] overflow-hidden">
                    {/* Resplandores suaves / Ambient glow */}
                    <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/15 blur-[120px]" />
                    <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-[#6cbdfe]/10 blur-[130px]" />
                    <div className="absolute top-[30%] left-[35%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]" />
                  </div>
                )}
                {/* Overlay gradiente premium */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/30 to-transparent z-0"></div>
                
                <div className="absolute inset-0 flex items-center px-8 max-w-7xl mx-auto text-white z-10">
                  <div className="max-w-3xl space-y-4">
                    {slide.subtitulo && (
                      <span className="inline-block bg-blue-500/20 text-[#6cbdfe] border border-blue-400/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        {slide.subtitulo}
                      </span>
                    )}
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-4 uppercase tracking-tighter leading-none text-white drop-shadow-md">
                      {slide.titulo}
                    </h1>
                    {slide.descripcion && (
                      <p className="text-base sm:text-lg mb-8 font-medium leading-relaxed text-gray-200 max-w-2xl">
                        {slide.descripcion}
                      </p>
                    )}
                    <button
                      onClick={() => handleButtonAction(slide.boton_accion || 'abrir_portal')}
                      className="rounded-2xl bg-[#6cbdfe] px-10 py-3.5 font-extrabold text-[#001d32] hover:bg-white transition-all transform hover:scale-102 hover:shadow-lg pointer-events-auto text-sm uppercase tracking-wider cursor-pointer"
                    >
                      {slide.boton_texto || 'Agendar Cita Ahora'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Sección Nuestro Propósito */}
        <section id="nosotros" className="py-28 bg-white border-y border-slate-50">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Lado izquierdo: Textos principales */}
            <div className="lg:col-span-5 text-left space-y-6">
              <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Sobre Nosotros
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] tracking-tighter leading-tight uppercase">
                {purpose.titulo}
              </h2>
              {purpose.subtitulo && (
                <p className="text-[#003178] font-bold text-sm uppercase tracking-wider border-l-4 border-[#6cbdfe] pl-4">
                  {purpose.subtitulo}
                </p>
              )}
              <p className="text-gray-650 text-base leading-relaxed">
                {purpose.descripcion}
              </p>
            </div>

            {/* Lado derecho: Tarjetas 2x2 */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {purposeItems.map((item, idx) => (
                <div 
                  key={item.id || idx} 
                  className="group rounded-2xl bg-[#f9f9fc] border border-slate-100 p-6 text-left hover:shadow-md hover:border-blue-200 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#003178] group-hover:bg-[#003178] group-hover:text-white transition-all duration-300">
                      <span className="material-symbols-outlined text-[24px]">
                        {item.icono || 'clinical_notes'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{item.titulo}</h3>
                    <p className="text-gray-550 text-xs leading-relaxed">{item.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* Sección de Servicios Clínicos */}
        <section id="servicios" className="py-28 bg-[#f9f9fc] text-center border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
            <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              Especialidades
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-4 tracking-tighter uppercase">Nuestros Servicios Clínicos</h2>
            <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full mb-16"></div>

            {loadingDB ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-650 font-bold">Cargando servicios...</span>
              </div>
            ) : services.length === 0 ? (
              <p className="text-gray-550 text-lg">Aún no hay servicios disponibles.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                {services.map((service) => (
                  <div 
                    key={service.id} 
                    className="group bg-white rounded-2xl border border-slate-100 p-8 hover:shadow-lg hover:border-blue-200 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Icono superior */}
                      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#003178] group-hover:bg-[#003178] group-hover:text-white transition-all duration-300">
                        <span className="material-symbols-outlined text-[28px]">
                          {service.icono || getServiceFallbackIcon(service.nombre_servicio)}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">{service.nombre_servicio}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed mb-6">
                        {service.descripcion || getServiceFallbackDesc(service.nombre_servicio)}
                      </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-50">
                      {/* Metadata: Duración y precio */}
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-gray-400">schedule</span>
                          {service.duracion_minutos || 45} min
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {service.precio_sesion ? `S/ ${service.precio_sesion}` : 'A consultar'}
                        </span>
                      </div>

                      {/* Botón de Agendar */}
                      <button
                        onClick={onOpenAuth}
                        className="w-full text-center bg-[#003178] hover:bg-blue-900 text-white font-bold py-2.5 px-4 rounded-xl transition-colors text-xs uppercase tracking-wider cursor-pointer"
                      >
                        Reservar Sesión
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sección de Especialistas */}
        <section id="specialists" className="py-28 bg-white text-center">
          <div className="max-w-7xl mx-auto px-6">
            <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              Equipo Profesional
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-4 tracking-tighter uppercase">Nuestros Especialistas</h2>
            <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full mb-16"></div>

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