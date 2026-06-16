import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verificarTokenIndependizacion, completarIndependizacion } from '../utils/supabaseHelpers';

const Independizarse = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  // Estados de carga y verificación de token
  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [pacienteData, setPacienteData] = useState(null);

  // Estados del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setVerifyingToken(false);
        setTokenValid(false);
        setError('El token de activación no está presente.');
        return;
      }

      try {
        const res = await verificarTokenIndependizacion(token);
        if (res.success && res.data) {
          setPacienteData(res.data);
          setEmail(res.data.correoSugerido || '');
          setTokenValid(true);
        } else {
          setError(res.error || 'El enlace de activación es inválido o ha expirado.');
          setTokenValid(false);
        }
      } catch (err) {
        setError('Ocurrió un error al verificar el enlace.');
        setTokenValid(false);
      } finally {
        setVerifyingToken(false);
      }
    };

    checkToken();
  }, [token]);

  const handleIndependizacion = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Por favor, ingresa un correo electrónico válido.');
      return;
    }

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
      const res = await completarIndependizacion({
        token,
        email: email.trim().toLowerCase(),
        password
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 4000);
      } else {
        setError(res.error || 'Error al completar la activación de cuenta.');
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado durante el proceso.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9fc] flex items-center justify-center p-4 font-['Manrope'] antialiased">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-blue-100/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-sky-100/20 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 sm:p-10 border border-slate-100">
        {/* Branding header */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-cepsitced.png" alt="Logo CEPSITCED" className="h-16 w-16 object-contain mb-3" />
          <h1 className="text-2xl font-black text-[#003178] uppercase tracking-tighter leading-none">CEPSITCED</h1>
          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider mt-1.5">Activar Cuenta Independiente</span>
        </div>

        {verifyingToken ? (
          <div className="text-center py-8 space-y-4">
            <span className="material-symbols-outlined animate-spin text-[#003178] text-[48px] notranslate" translate="no">sync</span>
            <p className="text-sm font-semibold text-gray-500">Verificando enlace de activación...</p>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm space-y-2 text-center">
              <span className="material-symbols-outlined text-red-500 text-[48px] block mx-auto notranslate" translate="no">error</span>
              <div className="font-bold text-red-950 text-base">Enlace Inválido o Expirado</div>
              <p className="mt-1">{error || 'El enlace que has utilizado no es válido, ha expirado (límite de 24 horas) o ya ha sido completado.'}</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-4 bg-[#003178] text-white font-black rounded-2xl shadow-xl hover:bg-blue-900 transition-all transform active:scale-95 tracking-widest text-xs uppercase cursor-pointer"
            >
              Ir al inicio de sesión
            </button>
          </div>
        ) : success ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm space-y-4 text-center">
            <span className="material-symbols-outlined text-emerald-600 text-[56px] block mx-auto notranslate" translate="no">check_circle</span>
            <div className="font-black text-emerald-950 text-lg uppercase tracking-tight">¡Cuenta Activada!</div>
            <p className="leading-relaxed">
              Tu cuenta de paciente independiente ha sido creada y activada con éxito. Ya puedes iniciar sesión en el portal utilizando tu DNI y contraseña.
            </p>
            <p className="text-xs text-emerald-600 font-bold animate-pulse mt-2">Redirigiendo al inicio de sesión en unos segundos...</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Ir al login ahora
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleIndependizacion}>
            {/* Paciente Details Summary */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-2">
              <div className="text-gray-400 font-bold uppercase tracking-wider">Ficha de Paciente a Activar:</div>
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-semibold text-gray-500">Paciente:</span>
                <span className="font-bold text-slate-900">
                  {pacienteData?.nombres} {pacienteData?.apellido_paterno} {pacienteData?.apellido_materno}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-semibold text-gray-500">DNI:</span>
                <span className="font-bold text-slate-900">{pacienteData?.dni}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-[18px] notranslate" translate="no">error</span>
                <p className="font-medium">{error}</p>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Confirmar Correo Electrónico</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#6cbdfe] outline-none transition-all text-sm font-medium"
              />
              <span className="text-[10px] text-gray-400 mt-1 ml-2 block">
                Este correo se utilizará para tu inicio de sesión y notificaciones.
              </span>
            </div>

            {/* Password Inputs */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Nueva Contraseña</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full p-4 pr-12 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#6cbdfe] outline-none transition-all text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer flex items-center"
                >
                  <span className="material-symbols-outlined text-[20px] notranslate" translate="no">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Confirmar Nueva Contraseña</label>
              <div className="relative">
                <input
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="w-full p-4 pr-12 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#6cbdfe] outline-none transition-all text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer flex items-center"
                >
                  <span className="material-symbols-outlined text-[20px] notranslate" translate="no">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-[#003178] text-white font-black rounded-2xl shadow-xl hover:bg-blue-900 transition-all transform active:scale-95 mt-6 tracking-widest text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? 'Activando...' : 'ACTIVAR CUENTA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Independizarse;
