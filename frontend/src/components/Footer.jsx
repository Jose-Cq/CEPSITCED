import React, { useState, useEffect } from 'react';
import { obtenerLocalesActivos } from '@backend/services/serviciosService.js';

const Footer = () => {
  const [locales, setLocales] = useState([]);

  useEffect(() => {
    const loadLocales = async () => {
      const data = await obtenerLocalesActivos();
      setLocales(data || []);
    };
    loadLocales();
  }, []);

  return (
    <footer className="bg-[#0b132b] text-slate-300 py-16 border-t border-slate-800 font-['Manrope']">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* About column */}
        <div className="space-y-4 text-left">
          <div className="flex items-center gap-3">
            <img src="/logo-cepsitced.png" alt="Logo CEPSITCED" className="h-10 w-10 object-contain" />
            <span className="text-white text-2xl font-black tracking-tighter uppercase">CEPSITCED</span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Centro psicológico especializado orientado a brindar atención ética, cálida y clínica para niños, adolescentes, adultos y familias.
          </p>
        </div>

        {/* Quick links */}
        <div className="space-y-4 text-left">
          <h4 className="text-white font-bold text-sm uppercase tracking-wider">Enlaces Rápidos</h4>
          <ul className="space-y-2.5 text-sm">
            <li>
              <a href="#inicio" className="hover:text-white transition-colors">Inicio</a>
            </li>
            <li>
              <a href="#nosotros" className="hover:text-white transition-colors">Nosotros</a>
            </li>
            <li>
              <a href="#servicios" className="hover:text-white transition-colors">Servicios Clínicos</a>
            </li>
            <li>
              <a href="#specialists" className="hover:text-white transition-colors">Especialistas</a>
            </li>
            <li>
              <a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a>
            </li>
          </ul>
        </div>

        {/* Services / Especialidades */}
        <div className="space-y-4 text-left">
          <h4 className="text-white font-bold text-sm uppercase tracking-wider">Especialidades</h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li>Terapia Individual (Jóvenes y Adultos)</li>
            <li>Terapia de Lenguaje e Infantil</li>
            <li>Evaluaciones Neuropsicológicas</li>
            <li>Terapia de Pareja y Familiar</li>
          </ul>
        </div>

        {/* Contact column */}
        <div className="space-y-4 text-left">
          <h4 className="text-white font-bold text-sm uppercase tracking-wider">Sedes & Contacto</h4>
          <div className="space-y-3 text-sm">
            {locales.map((loc) => (
              <div key={loc.id} className="flex items-start gap-2 text-slate-450">
                <span className="material-symbols-outlined text-[18px] text-[#6cbdfe] mt-0.5">location_on</span>
                <div>
                  <p className="text-slate-200 font-bold text-xs uppercase">{loc.nombre}</p>
                  <p className="text-slate-400 text-xs">{loc.direccion}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 text-slate-400 border-t border-slate-800">
              <span className="material-symbols-outlined text-[18px] text-[#6cbdfe]">mail</span>
              <span>contacto@cepsitced.com</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="material-symbols-outlined text-[18px] text-[#6cbdfe]">phone_in_talk</span>
              <span>+51 992 722 491</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-800/60 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-4">
        <p>© {new Date().getFullYear()} CEPSITCED. Todos los derechos reservados.</p>
        <p>Atención Psicológica Profesional con Calidez y Ética</p>
      </div>
    </footer>
  );
};

export default Footer;
