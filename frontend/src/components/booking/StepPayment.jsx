import { useState } from 'react';
import PaymentSummaryCard from '../PaymentSummaryCard';
import PaymentMethodCard from '../PaymentMethodCard';

/**
 * Paso de confirmación y pago.
 * Muestra resumen, método de pago y validación de cupón.
 */
const StepPayment = ({
  paraQuien,
  perfilUsuario,
  perfilClinicoPropio,
  perfilesDependientes,
  familiarId,
  psicologaSeleccionada,
  servicioSeleccionado,
  modalidad,
  localSeleccionado,
  fechaSeleccionada,
  slotSeleccionado,
  comentario,
  paqueteSeleccionado,
  metodoPago,
  setMetodoPago,
  precioFinalCalculado,
  precioConDescuento,
  couponData,
  onShowPaymentModal,
  bookingError,
  onApplyCoupon,
  onRemoveCoupon
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  let pacienteNombre;
  if (paraQuien === 'yo') {
    const nameYo = perfilClinicoPropio
      ? `${perfilClinicoPropio.nombres} ${perfilClinicoPropio.apellido_paterno} ${perfilClinicoPropio.apellido_materno || ''}`.trim()
      : `${perfilUsuario?.nombres} ${perfilUsuario?.apellido_paterno} ${perfilUsuario?.apellido_materno || ''}`.trim();
    pacienteNombre = `${nameYo} (Yo)`;
  } else {
    const dep = perfilesDependientes.find(d => d.id_paciente === familiarId);
    pacienteNombre = dep
      ? `${dep.nombres} ${dep.apellido_paterno} ${dep.apellido_materno || ''}`.trim()
      : '';
  }

  const handleApplyCoupon = async () => {
    setCouponError('');
    setCouponSuccess('');
    const result = await onApplyCoupon(couponCode, setCouponLoading, setCouponError, setCouponSuccess);
    if (result?.success) {
      // Coupon applied successfully
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponError('');
    setCouponSuccess('');
    onRemoveCoupon();
  };

  return (
    <div className="space-y-6">
      <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest border-b pb-2 text-left">Confirmación y Pago</h4>

      {bookingError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2 text-left">
          <span className="material-symbols-outlined text-red-500">error</span>
          {bookingError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <PaymentSummaryCard
          pacienteNombre={pacienteNombre}
          especialistaNombre={psicologaSeleccionada?.nombres_apellidos}
          servicioNombre={servicioSeleccionado?.nombre_servicio}
          modalidad={modalidad}
          localNombre={localSeleccionado?.nombre || 'Local Central'}
          fechaHoraTexto={`${fechaSeleccionada?.toLocaleDateString('es-PE')} de ${slotSeleccionado?.hora_inicio?.slice(0, 5) || '--:--'} a ${slotSeleccionado?.hora_fin?.slice(0, 5) || '--:--'}`}
          comentario={comentario}
        />

        <div className="md:col-span-5 space-y-4">
          <PaymentMethodCard
            paqueteSeleccionado={paqueteSeleccionado}
            metodoPago={metodoPago}
            modalidad={modalidad}
            precioFinal={couponData ? precioConDescuento : precioFinalCalculado}
            onMetodoPagoChange={setMetodoPago}
            onVerDatosPagoClick={onShowPaymentModal}
          />

          {paqueteSeleccionado?.type !== 'adquirido' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
              <h5 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
                Cupón o Código de Descuento
              </h5>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); setCouponSuccess(''); }}
                  placeholder="Ingresa tu código"
                  disabled={!!couponData}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:border-[#003178] outline-none text-gray-700 font-medium disabled:bg-gray-50 disabled:text-gray-400"
                />
                {couponData ? (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="px-3 py-2 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Quitar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#003178] rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    {couponLoading ? 'Validando...' : 'Aplicar'}
                  </button>
                )}
              </div>
              {couponError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  {couponError}
                </p>
              )}
              {couponSuccess && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  {couponSuccess}
                </p>
              )}
              {couponData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-800 space-y-1">
                  <p className="font-semibold">Descuento aplicado</p>
                  <p>Monto original: <span className="line-through">S/ {precioFinalCalculado}</span></p>
                  <p className="font-bold text-green-900">Total a pagar: S/ {precioConDescuento}</p>
                  {couponData.empresa_nombre && (
                    <p className="text-green-600">Convenio: {couponData.empresa_nombre}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepPayment;
