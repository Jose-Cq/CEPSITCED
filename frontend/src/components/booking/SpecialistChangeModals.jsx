import { obtenerNombreCorto } from './StepServiceSpecialist';

/**
 * Modal de primer cambio de especialista (aviso informativo).
 */
export const FirstChangeModal = ({ show, onClose, onConfirm, lastPsychologist }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 text-left animate-in zoom-in-95 duration-150 font-sans">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <span className="material-symbols-outlined text-2xl">help_outline</span>
          </div>
          <div>
            <h4 className="font-bold text-base text-gray-900">
              ¿Deseas continuar con el cambio?
            </h4>
            <p className="text-xs text-gray-550 mt-1 leading-relaxed">
              Anteriormente habías seleccionado a un especialista diferente ({lastPsychologist ? obtenerNombreCorto(lastPsychologist.psicologa_nombre || lastPsychologist.nombres_apellidos) : 'otro especialista'}). Para cuidar la continuidad de tu terapia, recomendamos seguir con el mismo profesional.
            </p>
          </div>
        </div>
        <div className="w-full flex justify-center items-center gap-4 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 h-10 flex items-center justify-center text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer text-center whitespace-nowrap"
          >
            Volver atrás
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2 h-10 flex items-center justify-center bg-[#003178] hover:bg-blue-900 text-white font-medium text-sm rounded-xl transition-all cursor-pointer text-center whitespace-nowrap"
          >
            Confirmar Cambio
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Modal de segundo cambio de especialista (advertencia con comentario).
 */
export const SecondChangeModal = ({
  show,
  onClose,
  onConfirm,
  comentarioCambio,
  setComentarioCambio
}) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 text-left animate-in zoom-in-95 duration-150 font-sans">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <div>
            <h4 className="font-bold text-base text-amber-800">
              Aviso importante de cambio
            </h4>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Esta es la última vez que podrás cambiar de psicólogo para este servicio de forma automática. Si decides proceder, tu continuidad terapéutica podría verse afectada.
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide">
            Déjanos un comentario del porqué de tu cambio (Opcional)
          </label>
          <textarea
            value={comentarioCambio}
            onChange={e => setComentarioCambio(e.target.value)}
            placeholder="Cuéntanos brevemente la razón de este cambio..."
            rows="3"
            className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:border-[#003178] outline-none resize-none bg-slate-50/50"
          />
        </div>

        <div className="w-full flex justify-center items-center gap-4 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 h-10 flex items-center justify-center text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer text-center whitespace-nowrap"
          >
            Volver atrás
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2 h-10 flex items-center justify-center bg-[#003178] hover:bg-blue-900 text-white font-medium text-sm rounded-xl transition-all cursor-pointer text-center whitespace-nowrap"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Modal de bloqueo absoluto de cambio (contactar recepción).
 */
export const BlockedChangeModal = ({ show, onClose, receptionPhone }) => {
  if (!show) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 text-left animate-in zoom-in-95 duration-150 font-sans"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <span className="material-symbols-outlined text-2xl">block</span>
          </div>
          <div>
            <h4 className="font-bold text-base text-red-700">
              Límite de cambios superado
            </h4>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Has alcanzado el límite máximo de cambios de especialista para este servicio. Para garantizar la continuidad de tu terapia, es necesario que continúes con tu psicólogo actual.
            </p>
            {receptionPhone ? (
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Si deseas realizar un cambio de especialista, por favor contáctate con Recepción al número: <strong className="text-red-700">{receptionPhone}</strong>.
              </p>
            ) : (
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Si deseas realizar un cambio de especialista, por favor contáctate con Recepción.
              </p>
            )}
          </div>
        </div>

        <div className="w-full flex justify-center mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-2.5 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-xl transition-all cursor-pointer text-center whitespace-nowrap"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
