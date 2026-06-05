import React, { useState, useEffect } from 'react';
import ValidatedInput from './ValidatedInput';
import { iniciarSesion } from '../utils/supabaseHelpers';

const AuthModal = ({ isOpen, onClose, onOpenRegister, onLoginSuccess }) => {
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ✅ CORREGIDO: Manejo correcto del límite de caracteres en React
  const handleDniChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Solo números
    if (value.length <= 12) {
      setDni(value);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // ← CORRECTO: iniciarSesionConDNI
      const resultado = await iniciarSesion(dni, password);

      if (resultado.success) {
        console.log('Inicio de sesión exitoso');
        if (onLoginSuccess) {
          onLoginSuccess(resultado.data);
        }
        onClose();
      } else {
        setError(resultado.error || 'DNI o contraseña incorrectos.');
      }
    } catch (err) {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Overlay con desenfoque */}
      <div
        className="absolute inset-0 bg-[#001d32]/85 backdrop-blur-md"
        onClick={onClose}
      ></div>

      {/* Contenedor Principal Split Screen */}
      <div className="relative w-full max-w-6xl h-[700px] grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden zoom-in animate-in duration-300">

        {/* LADO IZQUIERDO: BRANDING (AZUL) */}
        <div className="hidden lg:flex flex-col justify-between p-12 text-white relative bg-[#003178]">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 text-2xl font-black tracking-tighter">
              <div className="h-10 w-10 rounded-lg bg-white p-1 flex items-center justify-center">
                <span className="text-[#003178] font-black text-xl">C</span>
              </div>
              <span className="uppercase">CEPSITCED</span>
            </div>
            <p className="text-blue-200 font-medium text-sm mt-2">Portal Clínico Especializado</p>
          </div>

          <div className="relative z-10">
            <blockquote className="text-3xl font-bold leading-tight mb-8 tracking-tight">
              "Brindando empatía profesional para tu bienestar mental."
            </blockquote>
          </div>

          <div className="relative z-10 flex gap-6 border-t border-white/20 pt-8">
            <div className="text-center">
              <span className="material-symbols-outlined text-[#6cbdfe] block mb-1">calendar_month</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-100">Citas Online</span>
            </div>
            <div className="text-center">
              <span className="material-symbols-outlined text-[#6cbdfe] block mb-1">folder_shared</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-100">Historias</span>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO DE LOGIN */}
        <div className="flex flex-col p-8 md:p-14 bg-white relative justify-center">

          {/* Botón Cerrar */}
          <button
            onClick={onClose}
            className="absolute top-8 right-8 h-10 w-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-[#003178] transition-all"
            aria-label="Cerrar modal"
          >
            <span className="material-symbols-outlined font-bold">close</span>
          </button>

          <div className="max-w-sm mx-auto w-full">
            <h2 className="text-3xl font-black text-[#003178] mb-2 uppercase tracking-tighter">Bienvenida</h2>
            <p className="text-gray-400 mb-8 text-sm font-medium">
              Ingresa tus credenciales para acceder a tu panel personal.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleLogin}>
              {/* Input DNI corregido */}
              <div>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  value={dni}
                  onChange={handleDniChange}
                  placeholder="DNI / Carnet de Extranjería"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#6cbdfe] outline-none transition-all text-sm"
                  maxLength={12}
                />
                <p className="text-[10px] text-gray-400 mt-1 ml-2">{dni.length}/12 caracteres</p>
              </div>

              {/* Input Password */}
              <ValidatedInput
                type="password"
                placeholder="Contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#6cbdfe] outline-none transition-all text-sm"
              />

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  className="text-xs font-bold text-gray-400 hover:text-[#003178] text-left transition-colors"
                  onClick={() => alert('Funcionalidad de recuperación en desarrollo')}
                >
                  ¿Olvidaste tu contraseña?
                </button>

                {/* Link para abrir el registro */}
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="text-sm font-bold text-[#003178] text-left hover:underline decoration-2 underline-offset-4"
                >
                  ¿No tienes una cuenta? Regístrate aquí
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#003178] text-white font-black rounded-2xl shadow-xl hover:bg-blue-900 transition-all transform active:scale-95 mt-6 tracking-widest text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                    Iniciando sesión...
                  </>
                ) : (
                  'ENTRAR AL PORTAL'
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuthModal;
