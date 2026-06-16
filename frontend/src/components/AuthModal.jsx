import React, { useState, useEffect } from 'react';
import ValidatedInput from './ValidatedInput';
import { iniciarSesion, recuperarAcceso } from '../utils/supabaseHelpers';
import { supabase } from '../supabaseClient';
import loginMessages from '../data/loginMessages.json';

const AuthModal = ({ isOpen, onClose, onOpenRegister, onLoginSuccess }) => {
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [mode, setMode] = useState('login'); // 'login' or 'forgot'
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [randomMessage, setRandomMessage] = useState('');

  const [isStandbyPaciente, setIsStandbyPaciente] = useState(false);
  const [standbyDni, setStandbyDni] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [activationFlow, setActivationFlow] = useState(false);
  const [testEmailUrl, setTestEmailUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode('login');
      setError('');
      setRecoveryInput('');
      setRecoverySuccess('');
      setRecoveryError('');
      setDni('');
      setPassword('');
      setIsStandbyPaciente(false);
      setStandbyDni('');
      setResolvedEmail('');
      setActivationFlow(false);
      setTestEmailUrl('');

      const idx = Math.floor(Math.random() * loginMessages.length);
      setRandomMessage(loginMessages[idx]);
    }
  }, [isOpen]);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryLoading(true);
    setActivationFlow(false);
    setResolvedEmail('');

    try {
      const inputVal = recoveryInput.trim();
      const isEmail = /\S+@\S+\.\S+/.test(inputVal);

      if (isEmail) {
        // Enviar enlace de restablecimiento normal por correo
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(inputVal, {
          redirectTo: `${window.location.origin}/reset-password`
        });

        if (resetError) {
          setRecoveryError(resetError.message || 'Error al enviar el correo de recuperación.');
        } else {
          setRecoverySuccess(`Se ha enviado un enlace de recuperación al correo: ${inputVal}`);
        }
      } else {
        // Es un DNI. Llamar al backend para bifurcar flujo
        const response = await recuperarAcceso(inputVal, false); // false = solo verificar
        
        if (!response.success) {
          setRecoveryError(response.error || 'DNI no registrado o error de búsqueda.');
          return;
        }

        const { flow, email } = response.data;

        if (flow === 'NORMAL') {
          // Ya tiene cuenta activa. Enviar correo de restablecimiento de Supabase normal
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`
          });

          if (resetError) {
            setRecoveryError(resetError.message || 'Error al enviar el correo de recuperación.');
          } else {
            setRecoverySuccess(`Se ha enviado un enlace de recuperación al correo asociado: ${email}`);
          }
        } else if (flow === 'INDEPENDIZACION') {
          // Es dependiente standby sin cuenta. Mostrar banner y botón de activación
          setResolvedEmail(email);
          setActivationFlow(true);
          setRecoverySuccess(`Este paciente aún no tiene una cuenta independiente. Enviaremos una solicitud al correo del titular o apoderado registrado (${email}).`);
        }
      }
    } catch (err) {
      setRecoveryError(err.message || 'Ocurrió un error inesperado al procesar tu solicitud.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleSendActivationRequest = async () => {
    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryLoading(true);

    try {
      const inputVal = recoveryInput.trim();
      const response = await recuperarAcceso(inputVal, true); // true = enviar email real
      
      if (!response.success) {
        setRecoveryError(response.error || 'Error al enviar la solicitud.');
        return;
      }

      setRecoverySuccess(`Solicitud enviada correctamente al correo: ${resolvedEmail}. Revisa la bandeja de entrada para establecer la contraseña.`);
      if (response.data && response.data.etherealUrl) {
        setTestEmailUrl(response.data.etherealUrl);
      }
      setActivationFlow(false);
    } catch (err) {
      setRecoveryError(err.message || 'Error inesperado al enviar la solicitud.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  if (!isOpen) return null;

  // ✅ CORREGIDO: Manejo correcto del límite de caracteres en React
  const handleDniChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Solo números
    if (value.length <= 12) {
      setDni(value);
    }
  };

  const handleRequestActivation = () => {
    setIsStandbyPaciente(false);
    setMode('forgot');
    setRecoveryInput(standbyDni);
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setIsStandbyPaciente(false);
    setStandbyDni('');

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
        if (resultado.code === 'STANDBY_PACIENTE') {
          setIsStandbyPaciente(true);
          setStandbyDni(dni);
          setError(resultado.error || 'Este paciente ya está registrado, pero aún no cuenta con acceso independiente.');
        } else {
          setError(resultado.error || 'DNI o contraseña incorrectos.');
        }
      }
    } catch (err) {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-150">
      {/* Overlay con desenfoque */}
      <div
        className="absolute inset-0 bg-[#001d32]/85 backdrop-blur-md"
        onClick={onClose}
      ></div>

      {/* Contenedor Principal Split Screen */}
      <div className="relative w-full max-w-6xl h-auto lg:h-[700px] max-h-[90vh] lg:max-h-none grid grid-cols-1 lg:grid-cols-2 bg-transparent rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl overflow-hidden">

        {/* LADO IZQUIERDO: BRANDING (AZUL) */}
        <div className="hidden lg:flex flex-col justify-between p-12 text-white relative bg-[#003178] overflow-hidden rounded-l-[2rem] lg:rounded-l-[2.5rem]">
          {/* Abstract patterns/waves inside the blue container */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/35 blur-[90px]" />
            <div className="absolute -bottom-[20%] -right-[10%] w-[80%] h-[70%] rounded-full bg-[#6cbdfe]/20 blur-[110px]" />
            <svg className="absolute bottom-0 left-0 w-full opacity-10" viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,160C672,128,768,96,864,117.3C960,139,1056,213,1152,229.3C1248,245,1344,203,1392,181.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" fill="white"></path>
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <img src="/logo-cepsitced.png" alt="Logo" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-2xl font-black tracking-tighter uppercase leading-none text-white">CEPSITCED</h1>
                <span className="text-blue-200 text-[11px] font-bold uppercase tracking-wider block mt-1">Portal Clínico</span>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <blockquote className="text-2xl font-bold leading-tight mb-8 tracking-tight italic">
              “{randomMessage}”
            </blockquote>
          </div>

          <div className="relative z-10 border-t border-white/10 pt-6 text-left">
            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest leading-normal">
              © 2026 CEPSITCED. Todos los derechos reservados.
            </p>
            <p className="text-[11px] text-blue-100 font-medium mt-1 leading-snug">
              Atención Psicológica Profesional con Calidez y Ética
            </p>
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO DE LOGIN / RECUPERACIÓN */}
        <div className="flex flex-col p-6 sm:p-10 md:p-14 bg-white relative justify-center lg:rounded-r-[2.5rem] max-lg:rounded-[2rem] overflow-y-auto lg:overflow-hidden">

          {/* Botón Cerrar */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 md:top-8 md:right-8 h-10 w-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-[#003178] transition-all z-10 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <span className="material-symbols-outlined font-bold notranslate" translate="no">close</span>
          </button>

          <div className="max-w-sm mx-auto w-full">
            {mode === 'login' ? (
              <>
                <h2 className="text-3xl font-black text-[#003178] mb-2 uppercase tracking-tighter">Bienvenida</h2>
                <p className="text-gray-400 mb-8 text-sm font-medium">
                  Ingresa tus credenciales para acceder a tu panel personal.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-500 text-[18px] notranslate" translate="no">error</span>
                      {error}
                    </div>
                    {isStandbyPaciente && (
                      <button
                        type="button"
                        onClick={handleRequestActivation}
                        className="mt-1 py-2 px-3 bg-[#003178] hover:bg-blue-900 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider cursor-pointer transition-all self-start"
                      >
                        Solicitar cuenta independiente
                      </button>
                    )}
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
                      className="text-xs font-bold text-gray-400 hover:text-[#003178] text-left transition-colors cursor-pointer"
                      onClick={() => {
                        setMode('forgot');
                        setRecoveryInput('');
                        setRecoveryError('');
                        setRecoverySuccess('');
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>

                    {/* Link para abrir el registro */}
                    <button
                      type="button"
                      onClick={onOpenRegister}
                      className="text-sm font-bold text-[#003178] text-left hover:underline decoration-2 underline-offset-4 cursor-pointer"
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
                        <span className="material-symbols-outlined animate-spin text-sm notranslate" translate="no">sync</span>
                        Iniciando sesión...
                      </>
                    ) : (
                      'ENTRAR AL PORTAL'
                    )}
                  </button>
                </form>
              </>
            ) : (
              <form className="space-y-4" onSubmit={handleForgotPassword}>
                <h2 className="text-3xl font-black text-[#003178] mb-2 uppercase tracking-tighter">Recuperar Contraseña</h2>
                <p className="text-gray-400 mb-8 text-sm font-medium">
                  Ingresa tu DNI o el correo electrónico asociado a tu cuenta para recibir un enlace de restablecimiento.
                </p>

                {recoveryError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500 text-[18px] notranslate" translate="no">error</span>
                    {recoveryError}
                  </div>
                )}

                {recoverySuccess ? (
                  activationFlow ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm space-y-3">
                      <div className="flex items-center gap-2 font-black text-blue-950 uppercase tracking-tight text-xs">
                        <span className="material-symbols-outlined text-blue-600 notranslate" translate="no">info</span>
                        Cuenta registrada sin acceso propio
                      </div>
                      <p className="text-blue-800 leading-relaxed font-medium">{recoverySuccess}</p>
                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <button
                          type="button"
                          disabled={recoveryLoading}
                          onClick={handleSendActivationRequest}
                          className="flex-1 py-3 px-4 bg-[#003178] hover:bg-blue-900 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          {recoveryLoading ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-sm notranslate" translate="no">sync</span>
                              Enviando...
                            </>
                          ) : (
                            'Enviar Enlace'
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={recoveryLoading}
                          onClick={() => {
                            setMode('login');
                            setRecoveryInput('');
                            setRecoverySuccess('');
                            setActivationFlow(false);
                          }}
                          className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm space-y-2">
                      <div className="flex items-center gap-2 font-bold text-emerald-950">
                        <span className="material-symbols-outlined text-emerald-600 notranslate" translate="no">check_circle</span>
                        Enlace Enviado
                      </div>
                      <p>{recoverySuccess}</p>
                      {testEmailUrl && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-800 text-xs">
                          <p className="font-bold mb-1">Modo Desarrollo (Ethereal):</p>
                          <a 
                            href={testEmailUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[#003178] hover:underline font-semibold flex items-center gap-1 mt-1 break-all"
                          >
                            <span className="material-symbols-outlined text-[14px] notranslate" translate="no">open_in_new</span>
                            Abrir correo de prueba
                          </a>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setRecoveryInput('');
                          setRecoverySuccess('');
                          setTestEmailUrl('');
                        }}
                        className="mt-2 text-xs font-bold text-[#003178] hover:underline cursor-pointer block"
                      >
                        Volver al inicio de sesión
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    <div>
                      <input
                        required
                        type="text"
                        value={recoveryInput}
                        onChange={(e) => setRecoveryInput(e.target.value)}
                        placeholder="DNI o Correo Electrónico"
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#6cbdfe] outline-none transition-all text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={recoveryLoading}
                      className="w-full py-4 bg-[#003178] text-white font-black rounded-2xl shadow-xl hover:bg-blue-900 transition-all transform active:scale-95 mt-6 tracking-widest text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {recoveryLoading ? 'Enviando...' : 'ENVIAR ENLACE'}
                    </button>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setRecoveryError('');
                          setRecoverySuccess('');
                        }}
                        className="text-xs font-bold text-gray-400 hover:text-[#003178] transition-colors cursor-pointer"
                      >
                        Volver al inicio de sesión
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuthModal;
