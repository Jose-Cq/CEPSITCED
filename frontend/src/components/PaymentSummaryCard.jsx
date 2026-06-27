
const PaymentSummaryCard = ({
  pacienteNombre,
  especialistaNombre,
  servicioNombre,
  modalidad,
  localNombre,
  fechaHoraTexto,
  comentario
}) => {
  return (
    <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm text-left">
      <h5 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 font-sans">Resumen de la Cita</h5>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
        <div>
          <p className="text-xs text-gray-400">Paciente</p>
          <p className="font-bold text-slate-800 mt-0.5">{pacienteNombre}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Especialista</p>
          <p className="font-bold text-slate-800 mt-0.5">
            {especialistaNombre}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Servicio</p>
          <p className="font-bold text-[#003178] mt-0.5 font-sans">{servicioNombre}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Modalidad</p>
          <p className="font-bold text-slate-800 mt-0.5 capitalize">{modalidad}</p>
        </div>
        {modalidad === 'Presencial' && (
          <div>
            <p className="text-xs text-gray-400">Ubicación / Local</p>
            <p className="font-bold text-slate-800 mt-0.5">
              {localNombre || 'Local Central'}
            </p>
          </div>
        )}
        <div className="col-span-2">
          <p className="text-xs text-gray-400">Fecha y Hora</p>
          <p className="font-bold text-slate-800 mt-0.5">
            {fechaHoraTexto}
          </p>
        </div>
        {comentario && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400">Observación</p>
            <p className="text-xs text-gray-600 mt-0.5 italic">"{comentario}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSummaryCard;
