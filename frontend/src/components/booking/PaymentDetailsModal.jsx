import { useState } from 'react';
import { formatPhoneNumber } from '../../utils/appointmentFormatters';

/**
 * Modal de detalles de pago clínica (transferencia/yape).
 */
const PaymentDetailsModal = ({
  show,
  onClose,
  metodosPagoClinica,
  loadingMetodosPago,
  metodoPagoOnlineDetalle,
  setMetodoPagoOnlineDetalle,
  onNavigateAfterClose,
  paymentModalRedirectOnClose
}) => {
  const [copiedField, setCopiedField] = useState(null);

  if (!show) return null;

  const copyToClipboard = async (key, value) => {
    if (!value) return;
    try {
      const cleanValue = String(value).replace(/\s+/g, '');
      await navigator.clipboard.writeText(cleanValue);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('No se pudo copiar:', error);
    }
  };

  const handleClose = () => {
    onClose();
    if (paymentModalRedirectOnClose && onNavigateAfterClose) {
      onNavigateAfterClose();
    }
  };

  const activeTypes = [...new Set(metodosPagoClinica.map(m => m.tipo))];

  const renderTransferencia = () => {
    const item = metodosPagoClinica.find(m => m.tipo === 'TRANSFERENCIA') || {
      banco: 'BCP',
      moneda: 'Soles',
      numero_cuenta: '19134627591062',
      cci: '00219113462759106254',
      titular: 'Dra. Milagros Ordinola Villegas',
      mensaje_confirmacion: 'Realiza el depósito usando los datos seleccionados. Luego envía la captura de la transacción al número indicado para validar tu pago.',
      telefono_confirmacion: '992722491'
    };
    return (
      <div className="space-y-3">
        <div className="bg-slate-50 border border-slate-205 rounded-xl p-3.5 space-y-2.5 text-xs text-gray-700">
          <p><span className="font-bold text-slate-900 block mb-0.5 font-sans">Banco:</span> {item.banco}</p>
          <p><span className="font-bold text-slate-900 block mb-0.5 font-sans">Moneda:</span> {item.moneda}</p>
          
          <div className="flex items-center justify-between gap-2 border-b border-slate-150 pb-1.5">
            <div>
              <span className="font-bold text-slate-900 block mb-0.5 font-mono">Número de Cuenta:</span>
              <span className="font-mono">{item.numero_cuenta}</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard('cuenta', item.numero_cuenta)}
              className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
            >
              {copiedField === 'cuenta' ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-slate-150 pb-1.5">
            <div>
              <span className="font-bold text-slate-900 block mb-0.5 font-mono">CCI:</span>
              <span className="font-mono">{item.cci}</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard('cci', item.cci)}
              className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
            >
              {copiedField === 'cci' ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>

          <p><span className="font-bold text-slate-900 block mb-0.5 font-sans font-semibold">Titular:</span> {item.titular}</p>
        </div>
        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-0.5 font-sans">Instrucciones:</p>
          <p>{item.mensaje_confirmacion}</p>
          <div className="font-semibold text-[#003178] mt-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 font-sans">
              <span className="material-symbols-outlined text-[15px]">phone_iphone</span>
              WhatsApp: {formatPhoneNumber(item.telefono_confirmacion)}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard('whatsapp_trans', item.telefono_confirmacion)}
              className="px-2 py-0.5 text-[9px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
            >
              {copiedField === 'whatsapp_trans' ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderYape = () => {
    const item = metodosPagoClinica.find(m => m.tipo === 'YAPE') || {
      titular: 'Dra. Milagros Ordinola Villegas',
      numero_yape: '992722491',
      qr_url: null,
      mensaje_confirmacion: 'Realiza el yapeo usando los datos seleccionados. Luego envía la captura de la transacción al número indicado para validar tu pago.',
      telefono_confirmacion: '992722491'
    };
    const hasQr = item?.qr_url && String(item.qr_url).trim() !== '' && String(item.qr_url).trim().toLowerCase() !== 'null';
    return (
      <div className="space-y-3">
        <div className="bg-slate-55 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-gray-700">
          <div className="flex items-center justify-between gap-2 border-b border-slate-150 pb-1.5">
            <div>
              <span className="font-bold text-slate-900 block mb-0.5 font-sans">Número Yape:</span>
              <span className="font-mono">{formatPhoneNumber(item.numero_yape)}</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard('yape', item.numero_yape)}
              className="shrink-0 px-2 py-1 text-[10px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
            >
              {copiedField === 'yape' ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
          
          <p><span className="font-bold text-slate-900 block mb-0.5 font-sans font-semibold">Titular:</span> {item.titular}</p>
          
          {hasQr && (
            <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-lg mt-1">
              <img src={item.qr_url} alt="QR Yape" className="w-32 h-32 object-contain" />
            </div>
          )}
        </div>
        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-0.5 font-sans font-semibold">Instrucciones:</p>
          <p>{item.mensaje_confirmacion}</p>
          <div className="font-semibold text-[#003178] mt-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 font-sans">
              <span className="material-symbols-outlined text-[15px]">phone_iphone</span>
              WhatsApp: {formatPhoneNumber(item.telefono_confirmacion)}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard('whatsapp_yape', item.telefono_confirmacion)}
              className="px-2 py-0.5 text-[9px] font-bold border border-blue-200 text-[#003178] rounded hover:bg-blue-50 transition-colors cursor-pointer font-sans"
            >
              {copiedField === 'whatsapp_yape' ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <header className="p-4 border-b border-gray-100 flex justify-between items-center bg-[#003178] text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">credit_card</span>
            <div className="text-left">
              <h3 className="font-bold text-sm font-sans">Detalles de Pago Clínico</h3>
              <p className="text-[10px] text-blue-200">Realiza el pago antes de confirmar la cita</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-white hover:text-gray-200 p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </header>

        <div className="p-5 overflow-y-auto space-y-4 text-left flex-1 min-h-0">
          {activeTypes.length > 1 && (
            <div className="flex gap-2.5 shrink-0">
              {activeTypes.includes('TRANSFERENCIA') && (
                <button
                  type="button"
                  onClick={() => setMetodoPagoOnlineDetalle('TRANSFERENCIA')}
                  className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${metodoPagoOnlineDetalle === 'TRANSFERENCIA'
                      ? 'bg-[#003178] border-[#003178] text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                    }`}
                >
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                  Transferencia
                </button>
              )}
              {activeTypes.includes('YAPE') && (
                <button
                  type="button"
                  onClick={() => setMetodoPagoOnlineDetalle('YAPE')}
                  className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${metodoPagoOnlineDetalle === 'YAPE'
                      ? 'bg-[#003178] border-[#003178] text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                    }`}
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                  Yape
                </button>
              )}
              {activeTypes.filter(t => t !== 'TRANSFERENCIA' && t !== 'YAPE').map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setMetodoPagoOnlineDetalle(tipo)}
                  className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${metodoPagoOnlineDetalle === tipo
                      ? 'bg-[#003178] border-[#003178] text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-55'
                    }`}
                >
                  <span className="material-symbols-outlined text-[16px]">payments</span>
                  {tipo}
                </button>
              ))}
            </div>
          )}

          {loadingMetodosPago ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : metodoPagoOnlineDetalle === 'TRANSFERENCIA' ? (
            renderTransferencia()
          ) : (
            renderYape()
          )}
        </div>

        <footer className="p-4 border-t border-gray-100 flex justify-end shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm font-sans"
          >
            {paymentModalRedirectOnClose ? 'Finalizar' : 'Entendido'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PaymentDetailsModal;
