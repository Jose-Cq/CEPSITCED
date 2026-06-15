import React, { useState } from 'react';

const FaqSection = ({ faqs = [] }) => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleIndex = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="py-16 md:py-20 bg-white border-t border-slate-100 relative overflow-hidden font-['Manrope']">
      {/* Soft atmospheric radial gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-50/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold text-[#003178] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Preguntas
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#1a1c1e] mt-3 tracking-tighter uppercase leading-tight">
            Preguntas Frecuentes
          </h2>
          <div className="mx-auto mt-4 h-1 w-16 bg-[#6cbdfe] rounded-full"></div>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.id || index}
                className="group rounded-2xl border border-slate-100 bg-[#f9f9fc] hover:border-blue-200 transition-all duration-300 overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => toggleIndex(index)}
                  className="w-full flex items-center justify-between p-6 text-left font-bold text-gray-900 hover:text-[#003178] transition-colors focus:outline-none cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-base md:text-lg pr-4">{faq.pregunta}</span>
                  <span className={`material-symbols-outlined text-[24px] text-gray-400 group-hover:text-[#003178] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#003178]' : ''}`}>
                    expand_more
                  </span>
                </button>
                <div
                  className="transition-all duration-300 ease-in-out overflow-hidden"
                  style={{
                    maxHeight: isOpen ? '300px' : '0px',
                    opacity: isOpen ? 1 : 0
                  }}
                >
                  <div className="p-6 pt-0 text-gray-650 text-sm leading-relaxed border-t border-slate-100">
                    {faq.respuesta}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
