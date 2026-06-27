
const PaymentMethodCard = ({
  paqueteSeleccionado,
  metodoPago,
  modalidad,
  precioFinal,
  onMetodoPagoChange,
  onVerDatosPagoClick
}) => {
  const isPrepaid = paqueteSeleccionado?.type === 'adquirido';

  if (isPrepaid) {
    return (
      <div className="md:col-span-5 space-y-4 text-left">
        <h5 className="font-bold text-sm text-slate-700 mb-3 font-sans">Método de Pago</h5>
        <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl flex gap-3 shadow-sm">
          <span className="material-symbols-outlined text-emerald-600 text-[24px] shrink-0">check_circle</span>
          <div>
            <p className="font-bold text-sm">Sesión Pre-pagada</p>
            <p className="text-xs text-emerald-700 mt-0.5 font-medium">
              Se utilizará una sesión de tu paquete "{paqueteSeleccionado.nombre_paquete_snapshot || paqueteSeleccionado.nombre_paquete}".
            </p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1.5 uppercase">
              Método de pago: {paqueteSeleccionado.metodo_pago}
            </p>
          </div>
        </div>
        <div className="bg-[#003178]/5 border border-[#003178]/10 rounded-2xl p-4 flex justify-between items-center mt-6">
          <span className="font-bold text-sm text-slate-700">Total a pagar:</span>
          <span className="text-2xl font-black text-[#003178]">S/ 0</span>
        </div>
      </div>
    );
  }

  return (
    <div className="md:col-span-5 space-y-4 text-left">
      <h5 className="font-bold text-sm text-slate-700 mb-3 font-sans">Selecciona el Método de Pago</h5>

      <div className="flex flex-col gap-3">
        <label className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all ${metodoPago === 'clinica'
          ? 'border-[#003178] bg-blue-50/20 shadow-sm'
          : 'border-gray-200 hover:bg-gray-50'
          } ${modalidad === 'Virtual' ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <input
            type="radio"
            name="metodoPago"
            value="clinica"
            disabled={modalidad === 'Virtual'}
            checked={metodoPago === 'clinica'}
            onChange={() => onMetodoPagoChange('clinica')}
            className="w-4 h-4 text-[#003178] focus:ring-[#003178]"
          />
          <div className="ml-3 flex-1">
            <p className="font-bold text-sm text-gray-900 font-sans">Pago en Clínica</p>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Paga en la recepción física el día de tu cita</p>
          </div>
          <span className="material-symbols-outlined text-gray-400 text-[24px]">storefront</span>
        </label>

        <label className={`flex items-center p-4 border rounded-2xl cursor-pointer transition-all ${metodoPago === 'tarjeta'
          ? 'border-[#003178] bg-blue-50/20 shadow-sm'
          : 'border-gray-200 hover:bg-gray-50'
          }`}>
          <input
            type="radio"
            name="metodoPago"
            value="tarjeta"
            checked={metodoPago === 'tarjeta'}
            onChange={() => onMetodoPagoChange('tarjeta')}
            className="w-4 h-4 text-[#003178] focus:ring-[#003178]"
          />
          <div className="ml-3 flex-1">
            <p className="font-bold text-sm text-gray-900 font-sans">Pago Online</p>
            <p className="text-xs text-gray-505 mt-0.5">Transferencia bancaria o Yape</p>
          </div>
          <span className="material-symbols-outlined text-gray-400 text-[24px]">credit_card</span>
        </label>
      </div>

      {metodoPago === 'tarjeta' && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onVerDatosPagoClick}
            className="w-full py-3 px-4 border border-[#003178] text-[#003178] hover:bg-blue-50/50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">info</span>
            Ver datos de pago
          </button>
        </div>
      )}

      {modalidad === 'Virtual' && (
        <p className="text-[11px] text-amber-600 font-bold mt-1">
          * Para consultas virtuales, solo se permite Pago Online.
        </p>
      )}

      <div className="bg-[#003178]/5 border border-[#003178]/10 rounded-2xl p-4 flex justify-between items-center mt-6">
        <span className="font-bold text-sm text-slate-700">Total a pagar:</span>
        <span className="text-2xl font-black text-[#003178]">S/ {precioFinal}</span>
      </div>
    </div>
  );
};

export default PaymentMethodCard;
