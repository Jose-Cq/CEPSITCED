import React from 'react';

/**
 * Componente visual para mostrar el resumen del agendamiento.
 * 
 * @param {object} props
 * @param {Array} props.steps - Pasos del asistente.
 * @param {number} props.stepIndex - Índice del paso activo.
 * @param {string} props.paraQuien - Para quién es la cita ('yo' o 'familiar').
 * @param {object} props.perfilUsuario - Datos del perfil de usuario autenticado.
 * @param {object} props.perfilClinicoPropio - Ficha clínica del titular.
 * @param {Array} props.perfilesDependientes - Miembros de la familia.
 * @param {string|number} props.familiarId - ID del familiar seleccionado.
 * @param {string} props.modalidad - Modalidad elegida ('Presencial' o 'Virtual').
 * @param {object} props.localSeleccionado - Sede física seleccionada.
 * @param {object} props.servicioSeleccionado - Servicio clínico seleccionado.
 * @param {string} props.tipoSesion - Tipo de sesión ('normal' o 'paquete').
 * @param {object} props.paqueteSeleccionado - Paquete seleccionado.
 * @param {object} props.psicologaSeleccionada - Especialista seleccionada.
 * @param {Date} props.fechaSeleccionada - Fecha seleccionada.
 * @param {object} props.slotSeleccionado - Horario/slot seleccionado.
 * @param {string} props.montoEstimado - Monto formateado precalculado.
 * @param {boolean} [props.isMobile] - Determina si se renderiza en la versión móvil.
 */
const ReservationSummary = ({
  steps,
  stepIndex,
  paraQuien,
  perfilUsuario,
  perfilClinicoPropio,
  perfilesDependientes,
  familiarId,
  modalidad,
  localSeleccionado,
  servicioSeleccionado,
  tipoSesion,
  paqueteSeleccionado,
  psicologaSeleccionada,
  fechaSeleccionada,
  slotSeleccionado,
  montoEstimado,
  isMobile = false,
  onStepClick
}) => {
  const getStepIndexById = (id) => steps.findIndex(s => s.id === id);

  const isPacienteModalidadLocalActive = stepIndex >= getStepIndexById('paciente_modalidad_local');
  const isServicioPsicologoActive = stepIndex >= getStepIndexById('servicio_psicologo');
  const isHorarioActive = stepIndex >= getStepIndexById('horario');

  let pacienteNombre = '-';
  if (isPacienteModalidadLocalActive) {
    if (paraQuien === 'yo') {
      const nameYo = perfilClinicoPropio
        ? `${perfilClinicoPropio.nombres} ${perfilClinicoPropio.apellido_paterno} ${perfilClinicoPropio.apellido_materno || ''}`.trim()
        : `${perfilUsuario?.nombres} ${perfilUsuario?.apellido_paterno} ${perfilUsuario?.apellido_materno || ''}`.trim();
      pacienteNombre = `${nameYo} (Yo)`;
    } else if (paraQuien === 'familiar' && familiarId) {
      const dep = perfilesDependientes.find(d => d.id_paciente === familiarId);
      pacienteNombre = dep
        ? `${dep.nombres} ${dep.apellido_paterno} ${dep.apellido_materno || ''}`.trim()
        : '-';
    }
  }

  const modNombre = isPacienteModalidadLocalActive && modalidad ? modalidad : '-';

  let localNombre = '-';
  if (modalidad === 'Virtual') {
    localNombre = 'No aplica';
  } else if (isPacienteModalidadLocalActive && localSeleccionado) {
    localNombre = localSeleccionado.nombre;
  }

  const servicioNombre = isServicioPsicologoActive && servicioSeleccionado ? servicioSeleccionado.nombre_servicio : '-';

  let formaReserva = '-';
  if (isServicioPsicologoActive && servicioSeleccionado) {
    if (tipoSesion === 'normal') {
      formaReserva = 'Sesión Individual';
    } else if (tipoSesion === 'paquete' && paqueteSeleccionado) {
      formaReserva = 'Paquete';
    }
  }

  const especialistaNombre = isServicioPsicologoActive && psicologaSeleccionada?.nombres_apellidos ? psicologaSeleccionada.nombres_apellidos : '-';

  let fechaHoraStr = '-';
  if (isHorarioActive && fechaSeleccionada && slotSeleccionado) {
    fechaHoraStr = `${fechaSeleccionada.toLocaleDateString('es-PE')} a las ${slotSeleccionado.inicio}`;
  }

  const summaryItems = [
    { label: 'Paciente', value: pacienteNombre, active: pacienteNombre !== '-', stepId: 'paciente_modalidad_local' },
    { label: 'Modalidad', value: modNombre, active: modNombre !== '-', stepId: 'paciente_modalidad_local' },
  ];

  if (modalidad !== 'Virtual') {
    summaryItems.push({ label: 'Sede / Local', value: localNombre, active: localNombre !== '-' && localNombre !== 'No aplica', stepId: 'paciente_modalidad_local' });
  }

  summaryItems.push(
    { label: 'Servicio', value: servicioNombre, active: servicioNombre !== '-', stepId: 'servicio_psicologo' },
    { label: 'Tipo', value: formaReserva, active: formaReserva !== '-', stepId: 'servicio_psicologo' },
    { label: 'Especialista', value: especialistaNombre, active: especialistaNombre !== '-', stepId: 'servicio_psicologo' },
    { label: 'Fecha y Hora', value: fechaHoraStr, active: fechaHoraStr !== '-', stepId: 'horario' }
  );

  summaryItems.push({ label: 'Monto estimado', value: montoEstimado, active: montoEstimado !== '-', stepId: 'servicio_psicologo' });

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm text-left ${isMobile ? 'mb-6' : ''}`}>
      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 border-b pb-2 font-sans">
        Resumen de Reserva
      </h3>
      <div className="divide-y divide-gray-100">
        {summaryItems.map((item, idx) => {
          const itemStepIndex = getStepIndexById(item.stepId);
          const isClickable = item.active && onStepClick && itemStepIndex < stepIndex && item.label !== 'Monto estimado';
          return (
            <div key={idx} className="py-2.5 flex justify-between gap-4 text-xs items-center">
              <span className="text-gray-400 font-semibold uppercase tracking-wider">{item.label}</span>
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(item.stepId)}
                  className="text-right font-sans font-bold text-[#003178] hover:underline cursor-pointer focus:outline-none transition-all active:scale-95"
                >
                  {item.value}
                </button>
              ) : (
                <span className={`text-right font-sans font-bold ${item.active ? 'text-[#003178]' : 'text-gray-300'}`}>
                  {item.value}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReservationSummary;
