import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setError(updateError.message || 'Error al actualizar la contraseña.');
      } else {
        // Sign out to ensure the user does not enter the dashboard automatically
        await supabase.auth.signOut();
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 4000);
      }
    } catch (err) {
      setError('Ocurrió un error inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9fc] flex items-center justify-center p-4 font-['Manrope'] antialiased">
      {/* Background soft ambient effects */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-blue-100/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-sky-100/20 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 sm:p-10 border border-slate-100">
        {/* Branding header */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-cepsitced.png" alt="Logo CEPSITCED" className="h-16 w-16 object-contain mb-3" />
          <h1 className="text-2xl font-black text-[#003178] uppercase tracking-tighter leading-none">CEPSITCED</h1>
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider mt-1.5">Establecer Nueva Contraseña</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
            {error}
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm space-y-3 text-center">
            <span className="material-symbols-outlined text-emerald-600 text-[48px] block mx-auto">check_circle</span>
            <div className="font-bold text-emerald-950 text-base">¡Contraseña Actualizada!</div>
            <p>Tu contraseña se actualizó correctamente. Inicia sesión nuevamente para continuar. Redirigiendo al login...</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-2 text-xs font-bold text-[#003178] hover:underline cursor-pointer"
            >
              Ir al login ahora
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleResetPassword}>
            <div>
              <label className="block text-xs font-bold text-gray-550 uppercase tracking-wider mb-2 ml-1">Nueva Contraseña</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full p-4 pr-12 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#6cbdfe] outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer flex items-center"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-550 uppercase tracking-wider mb-2 ml-1">Confirmar Nueva Contraseña</label>
              <div className="relative">
                <input
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="w-full p-4 pr-12 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#6cbdfe] outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer flex items-center"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-[#003178] text-white font-black rounded-2xl shadow-xl hover:bg-blue-900 transition-all transform active:scale-95 mt-6 tracking-widest text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? 'Actualizando...' : 'ACTUALIZAR CONTRASEÑA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
