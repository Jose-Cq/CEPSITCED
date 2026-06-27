import React from 'react';

const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary', // 'primary' | 'danger'
}) => {
  if (!isOpen) return null;

  const confirmBtnStyles =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
      : 'bg-[#003178] hover:bg-blue-900 text-white focus:ring-blue-700';

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-6 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              variant === 'danger'
                ? 'bg-red-50 text-red-600'
                : 'bg-blue-50 text-[#003178]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">
              {variant === 'danger' ? 'warning' : 'info'}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 leading-tight">
              {title}
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 font-bold text-xs rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmBtnStyles}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
