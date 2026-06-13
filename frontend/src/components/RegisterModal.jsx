import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ValidatedInput from './ValidatedInput';
import { GRADOS_INSTRUCCION, ESTADOS_CIVILES } from '../constants/formOptions';
import { generarNumeroHC, calcularEdad } from '../utils/generateHC';
import { registrarPaciente, registrarPerfil, verificarDuplicadoDNI, obtenerUltimoNumeroHC, actualizarPaciente } from '../utils/supabaseHelpers';
import { supabase } from '../supabaseClient';

import countries from '../data/countries.json';
import departamentos from '../data/ubigeo_peru_2016_departamentos.json';
import provincias from '../data/ubigeo_peru_2016_provincias.json';
import distritos from '../data/ubigeo_peru_2016_distritos.json';

const toTitleCase = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s\-])\p{L}/gu, char => char.toUpperCase());
};

const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};


const getFlagEmoji = (iso2) => {
  if (!iso2) return '';
  const codePoints = iso2
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const FlagImage = ({ iso2, className = "w-5 h-3.5 object-cover rounded-sm border border-gray-200 shrink-0" }) => {
  const [hasError, setHasError] = useState(false);
  
  if (!iso2) {
    return <span className="text-base leading-none select-none">🌐</span>;
  }
  
  if (hasError) {
    const emoji = getFlagEmoji(iso2);
    return <span className="text-base leading-none select-none">{emoji || '🌐'}</span>;
  }
  
  const flagUrl = `https://purecatamphetamine.github.io/country-flag-icons/3x2/${iso2.toUpperCase()}.svg`;
  return (
    <img
      src={flagUrl}
      alt={iso2}
      onError={() => setHasError(true)}
      className={className}
    />
  );
};

const ComboBox = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccione...',
  searchable = false,
  required = false,
  disabled = false,
  className = '',
  id,
  dropdownWidth
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef(null);
  const [coords, setCoords] = useState(null);

  const selectedOption = options.find(opt => {
    if (typeof opt === 'object') {
      return opt.value === value;
    }
    return opt === value;
  });

  const getOptionLabel = (opt) => {
    if (!opt) return '';
    return typeof opt === 'object' ? opt.label : opt;
  };

  const getOptionValue = (opt) => {
    if (!opt) return '';
    return typeof opt === 'object' ? opt.value : opt;
  };

  const filteredOptions = searchable && search.trim() !== ''
    ? options.filter(opt => {
        if (typeof opt === 'object') {
          const label = opt.label.toLowerCase();
          const searchKey = opt.searchKey ? opt.searchKey.toLowerCase() : '';
          return label.includes(search.toLowerCase()) || searchKey.includes(search.toLowerCase());
        }
        return opt.toLowerCase().includes(search.toLowerCase());
      })
    : options;

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const windowWidth = window.innerWidth;
      const maxDropdownW = dropdownWidth ? parseInt(dropdownWidth) : 360;
      const estimatedWidth = Math.max(rect.width, Math.min(maxDropdownW, windowWidth * 0.9));
      
      let left = rect.left + scrollX;
      if (rect.left + estimatedWidth > windowWidth) {
        left = windowWidth - estimatedWidth - 16 + scrollX;
      }
      if (left < scrollX + 10) {
        left = scrollX + 10;
      }

      setCoords({
        top: rect.bottom + scrollY,
        left,
        width: rect.width
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSearch('');
      setCoords(null);
    }
  };

  const handleSelect = (opt) => {
    onChange(getOptionValue(opt));
    setIsOpen(false);
    setSearch('');
    setCoords(null);
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isOpen]);

  return (
    <div className={`relative w-full ${isOpen ? 'z-[50]' : 'z-10'} ${className}`} id={id}>
      <div
        ref={triggerRef}
        onClick={handleToggle}
        className={`w-full px-4 bg-gray-50 border rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] h-[54px] flex items-center justify-between cursor-pointer select-none ${
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-400 border-gray-200' : 'border-gray-200 hover:border-gray-300'
        } ${isOpen ? 'border-[#003178] ring-1 ring-[#003178]/10' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              {typeof selectedOption === 'object' && selectedOption.flag && (
                <span className="inline-flex items-center shrink-0">
                  {selectedOption.flag}
                </span>
              )}
              <span className="truncate">{getOptionLabel(selectedOption)}</span>
            </>
          ) : (
            <span className="text-gray-400 font-normal">{placeholder}</span>
          )}
        </div>
        <span className="material-symbols-outlined text-gray-400 select-none">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </div>

      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          className="absolute inset-x-0 bottom-0 h-0 opacity-0 pointer-events-none"
        />
      )}

      {isOpen && coords && createPortal(
        <>
          <div className="fixed inset-0 z-[99998]" onClick={() => { setIsOpen(false); setSearch(''); setCoords(null); }} />
          <div
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              minWidth: dropdownWidth ? undefined : `${coords.width}px`,
              width: dropdownWidth || 'max-content',
              maxWidth: dropdownWidth ? `min(${dropdownWidth}, 90vw)` : 'min(360px, 90vw)'
            }}
            className="bg-white border border-gray-200 rounded-2xl shadow-xl z-[99999] overflow-hidden flex flex-col max-h-64 transition-none animate-none"
          >
            {searchable && (
              <div className="p-2 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400 text-lg ml-2 select-none">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-transparent outline-none text-sm text-gray-700 py-1"
                  autoFocus
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 px-1">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>
            )}
            <div className="overflow-y-auto flex-1 py-1 max-h-48">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => {
                  const optVal = getOptionValue(opt);
                  const optLabel = getOptionLabel(opt);
                  const isSelected = optVal === value;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelect(opt)}
                      className={`px-4 py-3 hover:bg-gray-50 text-sm cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-blue-50/50 text-[#003178] font-bold' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        {typeof opt === 'object' && opt.flag && (
                          <span className="inline-flex items-center shrink-0">
                            {opt.flag}
                          </span>
                        )}
                        <span className="whitespace-normal break-words">{optLabel}</span>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[#003178] text-base shrink-0 select-none">check</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-xs text-gray-450 text-center">No se encontraron resultados</div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

const OPTIONS_LUGAR_FAMILIA = [
  "Hijo único/a",
  "Hijo/a mayor",
  "Hijo/a del medio",
  "Hijo/a menor",
  "Padre / Madre",
  "Tutor / Apoderado",
  "Otro"
];

const RegisterModal = ({ isOpen, onClose }) => {
  const [isProxy, setIsProxy] = useState(false);

  // Prefijos y números telefónicos por separado
  const [patientPhonePrefix, setPatientPhonePrefix] = useState('+51');
  const [patientPhoneNumber, setPatientPhoneNumber] = useState('');

  const [proxyPhonePrefix, setProxyPhonePrefix] = useState('+51');
  const [proxyPhoneNumber, setProxyPhoneNumber] = useState('');

  const [patientData, setPatientData] = useState({
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    dni: '',
    tipoDocumento: 'DNI',
    fechaNacimiento: '',
    edad: null,
    genero: '',
    pais: 'Perú', // Inicia con Perú por defecto
    departamento: '',
    provincia: '',
    distrito: '',
    lugarFamilia: '',
    estadoCivil: '',
    gradoInstruccion: '',
    ocupacion: '',
    direccion: '',
    telefono: '',
    correoReal: ''
  });

  const [proxyData, setProxyData] = useState({
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    dni: '',
    tipoDocumento: 'DNI',
    fechaNacimiento: '',
    edad: null,
    telefono: '',
    correoReal: '',
    parentesco: '',
    genero: ''
  });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const getTodayDate = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  };

  const getMaxDate = () => {
    const hoy = new Date();
    return `${hoy.getFullYear() - 1}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  };

  const getMinDate = () => {
    const hoy = new Date();
    return `${hoy.getFullYear() - 120}-01-01`;
  };

  // Sincronizar prefijo de celular al cambiar de país en paciente
  const handlePatientCountryChange = (val) => {
    setPatientData(prev => ({
      ...prev,
      pais: val,
      departamento: '',
      provincia: '',
      distrito: '',
      tipoDocumento: val === 'Perú' ? 'DNI' : 'Carnet de extranjería'
    }));

    const cObj = countries.find(c => c.nameES === val);
    if (cObj) {
      const newPrefix = `+${cObj.phoneCode}`;
      setPatientPhonePrefix(newPrefix);
      if (newPrefix === '+51') {
        setPatientPhoneNumber(prev => prev.slice(0, 9));
      }
    }
  };

  // Al cambiar entre paciente/apoderado
  const handleToggleProxy = (proxyVal) => {
    setIsProxy(proxyVal);
    if (proxyVal) {
      setPatientData(prev => ({
        ...prev,
        correoReal: '',
        telefono: ''
      }));
      setPatientPhoneNumber('');
    } else {
      setProxyData({
        nombres: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        dni: '',
        tipoDocumento: 'DNI',
        fechaNacimiento: '',
        edad: null,
        telefono: '',
        correoReal: '',
        parentesco: '',
        genero: ''
      });
      setProxyPhoneNumber('');
    }
  };

  const resetForm = () => {
    setPatientData({
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      dni: '',
      tipoDocumento: 'DNI',
      fechaNacimiento: '',
      edad: null,
      genero: '',
      pais: 'Perú',
      departamento: '',
      provincia: '',
      distrito: '',
      lugarFamilia: '',
      estadoCivil: '',
      gradoInstruccion: '',
      ocupacion: '',
      direccion: '',
      telefono: '',
      correoReal: ''
    });
    setProxyData({
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      dni: '',
      tipoDocumento: 'DNI',
      fechaNacimiento: '',
      edad: null,
      telefono: '',
      correoReal: '',
      parentesco: '',
      genero: ''
    });
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setSubmitError('');
    setSuccessMessage('');
    setIsProxy(false);
    setPatientPhonePrefix('+51');
    setPatientPhoneNumber('');
    setProxyPhonePrefix('+51');
    setProxyPhoneNumber('');
  };

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

  const handleLimitInput = (e, limit, setter) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= limit) setter(value);
  };

  const handleNameChange = (field, rawValue, isPatient) => {
    const cleaned = rawValue.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '');
    if (isPatient) {
      handlePatientChange(field, cleaned);
    } else {
      handleProxyChange(field, cleaned);
    }
  };

  const handlePatientChange = (field, value) => {
    const updated = { ...patientData, [field]: value };
    if (field === 'fechaNacimiento') updated.edad = calcularEdad(value);
    setPatientData(updated);
  };

  const handleProxyChange = (field, value) => {
    const updated = { ...proxyData, [field]: value };
    if (field === 'fechaNacimiento') updated.edad = calcularEdad(value);
    setProxyData(updated);
  };

  const handlePatientDepartmentChange = (deptName) => {
    setPatientData(prev => ({
      ...prev,
      departamento: deptName,
      provincia: '',
      distrito: ''
    }));
  };

  const handlePatientProvinceChange = (provName) => {
    setPatientData(prev => ({
      ...prev,
      provincia: provName,
      distrito: ''
    }));
  };

  const validatePassword = (pass) => {
    if (!pass) return '';
    if (pass.length < 8) return 'Mínimo 8 caracteres.';
    if (!/[A-Z]/.test(pass)) return 'Falta una mayúscula.';
    if (!/[.@!#$%&]/.test(pass)) return 'Falta un símbolo (. @ ! # $ % &)';
    return '';
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordError(validatePassword(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError('');
    setSuccessMessage('');

    // Combinar teléfonos
    const patientPhoneFull = patientPhoneNumber ? `${patientPhonePrefix} ${patientPhoneNumber.trim()}`.trim() : '';
    const proxyPhoneFull = proxyPhoneNumber ? `${proxyPhonePrefix} ${proxyPhoneNumber.trim()}`.trim() : '';

    const finalPatientData = { ...patientData, telefono: patientPhoneFull };
    const finalProxyData = { ...proxyData, telefono: proxyPhoneFull };

    // Validar dirección obligatoria
    if (!finalPatientData.direccion || finalPatientData.direccion.trim() === '') {
      setSubmitError('La dirección es obligatoria.');
      return;
    }

    // Validar nacionalidad
    if (!finalPatientData.pais) {
      setSubmitError('El país de nacionalidad es obligatorio.');
      return;
    }

    if (finalPatientData.pais === 'Perú' && (!finalPatientData.departamento || !finalPatientData.provincia || !finalPatientData.distrito)) {
      setSubmitError('El departamento, provincia y distrito son obligatorios para Perú.');
      return;
    }

    // Validar contraseñas
    if (password !== confirmPassword) {
      setSubmitError('Las contraseñas no coinciden.');
      return;
    }
    if (passwordError) {
      setSubmitError('Corrige los errores de contraseña.');
      return;
    }
    if (!finalPatientData.fechaNacimiento) {
      setSubmitError('La fecha de nacimiento es obligatoria.');
      return;
    }

    const todayStr = getTodayDate();
    if (finalPatientData.fechaNacimiento > todayStr) {
      setSubmitError('La fecha de nacimiento no puede ser una fecha futura.');
      return;
    }

    const fechaNac = new Date(finalPatientData.fechaNacimiento);
    const añoNacimiento = fechaNac.getFullYear();
    if (añoNacimiento < 1900) {
      setSubmitError('Fecha de nacimiento no válida.');
      return;
    }

    // Validaciones de Documento del Paciente y Apoderado
    const patientDniClean = String(finalPatientData.dni || '').replace(/\D/g, '');
    const proxyDniClean = isProxy ? String(finalProxyData.dni || '').replace(/\D/g, '') : '';

    if (!patientDniClean) {
      setSubmitError('El documento del paciente es obligatorio.');
      return;
    }
    if (finalPatientData.tipoDocumento === 'DNI' && patientDniClean.length !== 8) {
      setSubmitError('El DNI del paciente debe tener exactamente 8 dígitos.');
      return;
    }
    if (finalPatientData.tipoDocumento !== 'DNI' && (patientDniClean.length < 8 || patientDniClean.length > 12)) {
      setSubmitError('El Carnet de extranjería del paciente debe tener entre 8 y 12 dígitos.');
      return;
    }

    // Validar modo apoderado
    if (isProxy) {
      if (!proxyDniClean || !finalProxyData.nombres || !finalProxyData.apellidoPaterno || !finalProxyData.apellidoMaterno) {
        setSubmitError('Completa los datos del apoderado.');
        return;
      }
      const proxyDniLen = proxyDniClean.length;
      if (proxyDniLen < 8 || proxyDniLen > 12) {
        setSubmitError('El documento del apoderado debe tener entre 8 y 12 dígitos.');
        return;
      }
      finalProxyData.tipoDocumento = proxyDniLen === 8 ? 'DNI' : 'Carnet de extranjería';
      if (finalProxyData.fechaNacimiento > todayStr) {
        setSubmitError('La fecha de nacimiento del apoderado no puede ser una fecha futura.');
        return;
      }
      const proxyFechaNac = new Date(finalProxyData.fechaNacimiento);
      if (proxyFechaNac.getFullYear() < 1900) {
        setSubmitError('Fecha de nacimiento del apoderado no válida.');
        return;
      }
      if (!proxyPhoneFull) {
        setSubmitError('El celular del apoderado es obligatorio.');
        return;
      }
      const proxyDigits = proxyPhoneNumber.replace(/\D/g, '');
      if (proxyPhonePrefix === '+51') {
        if (proxyDigits.length !== 9) {
          setSubmitError('El celular del apoderado para Perú (+51) debe tener exactamente 9 dígitos.');
          return;
        }
      } else {
        if (proxyDigits.length < 5 || proxyDigits.length > 15) {
          setSubmitError('El celular del apoderado debe tener entre 5 y 15 dígitos.');
          return;
        }
      }
      if (!finalProxyData.parentesco) {
        setSubmitError('El parentesco del apoderado es obligatorio.');
        return;
      }
      if (!finalProxyData.genero) {
        setSubmitError('El género del apoderado es obligatorio.');
        return;
      }
      if (!finalProxyData.correoReal || !isValidEmail(finalProxyData.correoReal)) {
        setSubmitError('El correo electrónico del apoderado es obligatorio y debe ser un correo válido.');
        return;
      }
    } else {
      // Validar correo y teléfono del paciente cuando no es apoderado
      if (!patientPhoneFull) {
        setSubmitError('El celular es obligatorio.');
        return;
      }
      const patientDigits = patientPhoneNumber.replace(/\D/g, '');
      if (patientPhonePrefix === '+51') {
        if (patientDigits.length !== 9) {
          setSubmitError('El celular para Perú (+51) debe tener exactamente 9 dígitos.');
          return;
        }
      } else {
        if (patientDigits.length < 5 || patientDigits.length > 15) {
          setSubmitError('El celular debe tener entre 5 y 15 dígitos.');
          return;
        }
      }
      if (!finalPatientData.correoReal || !isValidEmail(finalPatientData.correoReal)) {
        setSubmitError('El correo electrónico es obligatorio y debe ser un correo válido.');
        return;
      }
    }

    setIsSubmitting(true);
    sessionStorage.setItem('is_registering', 'true');

    try {
      // 1. Verificar duplicados de DNI en la base de datos (perfiles de usuario)
      const patientDniDup = await verificarDuplicadoDNI(patientDniClean);
      if (patientDniDup.error) {
        throw new Error(`Error al verificar DNI del paciente: ${patientDniDup.error}`);
      }
      if (patientDniDup.duplicated) {
        throw new Error('Ya existe un perfil registrado con este DNI.');
      }

      if (isProxy) {
        if (patientDniClean === proxyDniClean) {
          throw new Error('El DNI del apoderado y del paciente no pueden ser iguales.');
        }

        const proxyDniDup = await verificarDuplicadoDNI(proxyDniClean);
        if (proxyDniDup.error) {
          throw new Error(`Error al verificar DNI del apoderado: ${proxyDniDup.error}`);
        }
        if (proxyDniDup.duplicated) {
          throw new Error('Ya existe un perfil registrado con este DNI.');
        }
      }

      // 2. Obtener el último número de historia clínica
      const ultimoHC = await obtenerUltimoNumeroHC();

      // 3. Registrar según tipo (con o sin apoderado)
      if (!isProxy) {
        // --- CASO: PACIENTE INDEPENDIENTE ---
        const { numeroHC } = generarNumeroHC(
          finalPatientData.fechaNacimiento,
          finalPatientData.genero,
          ultimoHC
        );

        const authEmail = finalPatientData.correoReal.trim().toLowerCase();

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: authEmail,
          password,
        });

        if (authError) {
          if (authError.message?.includes('rate limit')) throw new Error('Demasiados intentos. Espera unos minutos.');
          throw new Error(`Error de registro: ${authError.message}`);
        }

        const authId = authData.user?.id;
        if (!authId) throw new Error('No se pudo crear la cuenta de usuario.');

        if (!numeroHC) throw new Error('Error al generar la Historia Clínica.');
        if (!patientDniClean) throw new Error('El DNI del paciente es obligatorio.');
        if (!finalPatientData.genero) throw new Error('El género del paciente es obligatorio.');
        if (!finalPatientData.fechaNacimiento) throw new Error('La fecha de nacimiento del paciente es obligatoria.');

        const perfilRes = await registrarPerfil({
          id: authId,
          dni: patientDniClean,
          nombres: toTitleCase(finalPatientData.nombres) ?? null,
          apellido_paterno: toTitleCase(finalPatientData.apellidoPaterno) ?? null,
          apellido_materno: toTitleCase(finalPatientData.apellidoMaterno) ?? null,
          fecha_nacimiento: finalPatientData.fechaNacimiento,
          telefono: finalPatientData.telefono ?? null,
          correo: authEmail
        });

        if (!perfilRes.success) throw new Error(`Error de perfil: ${perfilRes.error}`);

        // Verificar si ya existe el registro en pacientes por DNI antes de crear uno nuevo
        const { data: pacienteExistente, error: errExistente } = await supabase
          .from('pacientes')
          .select('*')
          .eq('dni', patientDniClean)
          .maybeSingle();

        if (errExistente) {
          console.error('Error al buscar paciente existente:', errExistente);
        }

        let pacienteRes;
        if (pacienteExistente) {
          pacienteRes = await actualizarPaciente(pacienteExistente.id_paciente, {
            id_perfil_propio: authId,
            nombres: toTitleCase(finalPatientData.nombres) || pacienteExistente.nombres,
            apellido_paterno: toTitleCase(finalPatientData.apellidoPaterno) || pacienteExistente.apellido_paterno,
            apellido_materno: toTitleCase(finalPatientData.apellidoMaterno) || pacienteExistente.apellido_materno,
            telefono: finalPatientData.telefono || pacienteExistente.telefono,
            correo: authEmail,
            genero: finalPatientData.genero,
            fecha_nacimiento: finalPatientData.fechaNacimiento,
            pais: toTitleCase(finalPatientData.pais) || pacienteExistente.pais,
            departamento: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.departamento) || pacienteExistente.departamento) : null,
            provincia: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.provincia) || pacienteExistente.provincia) : null,
            distrito: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.distrito) || pacienteExistente.distrito) : null,
            direccion: toTitleCase(finalPatientData.direccion) || pacienteExistente.direccion,
            lugar_familia: toTitleCase(finalPatientData.lugarFamilia) || pacienteExistente.lugar_familia,
            estado_civil: toTitleCase(finalPatientData.estadoCivil) || pacienteExistente.estado_civil,
            grado_instruccion: toTitleCase(finalPatientData.gradoInstruccion) || pacienteExistente.grado_instruccion,
            ocupacion: toTitleCase(finalPatientData.ocupacion) || pacienteExistente.ocupacion
          });
        } else {
          pacienteRes = await registrarPaciente({
            numero_hc: numeroHC,
            dni: patientDniClean,
            genero: finalPatientData.genero,
            fecha_nacimiento: finalPatientData.fechaNacimiento,
            lugar_familia: toTitleCase(finalPatientData.lugarFamilia) ?? null,
            estado_civil: toTitleCase(finalPatientData.estadoCivil) ?? null,
            grado_instruccion: toTitleCase(finalPatientData.gradoInstruccion) ?? null,
            ocupacion: toTitleCase(finalPatientData.ocupacion) ?? null,
            direccion: toTitleCase(finalPatientData.direccion) ?? null,
            telefono: finalPatientData.telefono ?? null,
            correo: authEmail,
            nombres: toTitleCase(finalPatientData.nombres) ?? null,
            apellido_paterno: toTitleCase(finalPatientData.apellidoPaterno) ?? null,
            apellido_materno: toTitleCase(finalPatientData.apellidoMaterno) ?? null,
            pais: toTitleCase(finalPatientData.pais) ?? null,
            departamento: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.departamento) ?? null) : null,
            provincia: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.provincia) ?? null) : null,
            distrito: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.distrito) ?? null) : null,
            estado_cuenta: 'INDEPENDIENTE',
            id_perfil_propio: authId,
            id_apoderado: null,
            parentesco: null
          });
        }

        if (!pacienteRes.success) throw new Error(`Error de paciente: ${pacienteRes.error}`);

        const hcMostrada = pacienteExistente ? pacienteExistente.numero_hc : numeroHC;
        setSuccessMessage(`¡Registro exitoso! Historia Clínica: ${hcMostrada}. Redirigiendo al portal...`);
        sessionStorage.removeItem('is_registering');
        setTimeout(() => {
          resetForm();
          onClose();
          window.location.href = '/dashboard';
        }, 3000);

      } else {
        // --- CASO: REGISTRO CON APODERADO ---
        const pRes = generarNumeroHC(
          finalPatientData.fechaNacimiento,
          finalPatientData.genero,
          ultimoHC
        );
        const patientHC = pRes.numeroHC;

        const aRes = generarNumeroHC(
          finalProxyData.fechaNacimiento,
          finalProxyData.genero,
          patientHC
        );
        const proxyHC = aRes.numeroHC;

        const proxyAuthEmail = finalProxyData.correoReal.trim().toLowerCase();

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: proxyAuthEmail,
          password,
        });

        if (authError) {
          if (authError.message?.includes('rate limit')) throw new Error('Demasiados intentos. Espera unos minutos.');
          throw new Error(`Error de registro apoderado: ${authError.message}`);
        }

        const authId = authData.user?.id;
        if (!authId) throw new Error('No se pudo crear la cuenta del apoderado.');

        if (!proxyHC) throw new Error('Error al generar la Historia Clínica del apoderado.');
        if (!proxyDniClean) throw new Error('El DNI del apoderado es obligatorio.');
        if (!finalProxyData.genero) throw new Error('El género del apoderado es obligatorio.');
        if (!finalProxyData.fechaNacimiento) throw new Error('La fecha de nacimiento del apoderado es obligatoria.');

        if (!patientHC) throw new Error('Error al generar la Historia Clínica del paciente.');
        if (!patientDniClean) throw new Error('El DNI del paciente es obligatorio.');
        if (!finalPatientData.genero) throw new Error('El género del paciente es obligatorio.');
        if (!finalPatientData.fechaNacimiento) throw new Error('La fecha de nacimiento del paciente es obligatoria.');

        const perfilRes = await registrarPerfil({
          id: authId,
          dni: proxyDniClean,
          nombres: toTitleCase(finalProxyData.nombres) ?? null,
          apellido_paterno: toTitleCase(finalProxyData.apellidoPaterno) ?? null,
          apellido_materno: toTitleCase(finalProxyData.apellidoMaterno) ?? null,
          fecha_nacimiento: finalProxyData.fechaNacimiento,
          telefono: finalProxyData.telefono ?? null,
          correo: proxyAuthEmail
        });

        if (!perfilRes.success) throw new Error(`Error de perfil de apoderado: ${perfilRes.error}`);

        // Verificar si el apoderado ya existe en pacientes por DNI
        const { data: apoderadoExistente, error: errApoExistente } = await supabase
          .from('pacientes')
          .select('*')
          .eq('dni', proxyDniClean)
          .maybeSingle();

        if (errApoExistente) {
          console.error('Error al buscar apoderado existente:', errApoExistente);
        }

        let apoderadoPacienteRes;
        if (apoderadoExistente) {
          apoderadoPacienteRes = await actualizarPaciente(apoderadoExistente.id_paciente, {
            id_perfil_propio: authId,
            nombres: toTitleCase(finalProxyData.nombres) || apoderadoExistente.nombres,
            apellido_paterno: toTitleCase(finalProxyData.apellidoPaterno) || apoderadoExistente.apellido_paterno,
            apellido_materno: toTitleCase(finalProxyData.apellidoMaterno) || apoderadoExistente.apellido_materno,
            telefono: finalProxyData.telefono || apoderadoExistente.telefono,
            correo: proxyAuthEmail,
            genero: finalProxyData.genero,
            fecha_nacimiento: finalProxyData.fechaNacimiento,
            direccion: toTitleCase(finalPatientData.direccion) || apoderadoExistente.direccion
          });
        } else {
          apoderadoPacienteRes = await registrarPaciente({
            numero_hc: proxyHC,
            dni: proxyDniClean,
            genero: finalProxyData.genero,
            fecha_nacimiento: finalProxyData.fechaNacimiento,
            direccion: toTitleCase(finalPatientData.direccion) ?? null,
            telefono: finalProxyData.telefono ?? null,
            correo: proxyAuthEmail,
            nombres: toTitleCase(finalProxyData.nombres) ?? null,
            apellido_paterno: toTitleCase(finalProxyData.apellidoPaterno) ?? null,
            apellido_materno: toTitleCase(finalProxyData.apellidoMaterno) ?? null,
            pais: toTitleCase(finalPatientData.pais) ?? null,
            departamento: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.departamento) ?? null) : null,
            provincia: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.provincia) ?? null) : null,
            distrito: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.distrito) ?? null) : null,
            estado_cuenta: 'INDEPENDIENTE',
            id_perfil_propio: authId,
            id_apoderado: null,
            parentesco: null
          });
        }

        if (!apoderadoPacienteRes.success) throw new Error(`Error de paciente (apoderado): ${apoderadoPacienteRes.error}`);

        // Verificar si el paciente dependiente ya existe en pacientes por DNI
        const { data: pacienteExistente, error: errPacExistente } = await supabase
          .from('pacientes')
          .select('*')
          .eq('dni', patientDniClean)
          .maybeSingle();

        if (errPacExistente) {
          console.error('Error al buscar paciente dependiente existente:', errPacExistente);
        }

        let pacienteRes;
        if (pacienteExistente) {
          pacienteRes = await actualizarPaciente(pacienteExistente.id_paciente, {
            id_apoderado: authId,
            estado_cuenta: 'STANDBY',
            parentesco: toTitleCase(finalProxyData.parentesco) || pacienteExistente.parentesco,
            nombres: toTitleCase(finalPatientData.nombres) || pacienteExistente.nombres,
            apellido_paterno: toTitleCase(finalPatientData.apellidoPaterno) || pacienteExistente.apellido_paterno,
            apellido_materno: toTitleCase(finalPatientData.apellidoMaterno) || pacienteExistente.apellido_materno,
            telefono: finalProxyData.telefono || pacienteExistente.telefono,
            correo: proxyAuthEmail,
            genero: finalPatientData.genero,
            fecha_nacimiento: finalPatientData.fechaNacimiento,
            direccion: toTitleCase(finalPatientData.direccion) || pacienteExistente.direccion,
            lugar_familia: toTitleCase(finalPatientData.lugarFamilia) || pacienteExistente.lugar_familia,
            estado_civil: toTitleCase(finalPatientData.estadoCivil) || pacienteExistente.estado_civil,
            grado_instruccion: toTitleCase(finalPatientData.gradoInstruccion) || pacienteExistente.grado_instruccion,
            ocupacion: toTitleCase(finalPatientData.ocupacion) || pacienteExistente.ocupacion
          });
        } else {
          pacienteRes = await registrarPaciente({
            numero_hc: patientHC,
            dni: patientDniClean,
            genero: finalPatientData.genero,
            fecha_nacimiento: finalPatientData.fechaNacimiento,
            lugar_familia: toTitleCase(finalPatientData.lugarFamilia) ?? null,
            estado_civil: toTitleCase(finalPatientData.estadoCivil) ?? null,
            grado_instruccion: toTitleCase(finalPatientData.gradoInstruccion) ?? null,
            ocupacion: toTitleCase(finalPatientData.ocupacion) ?? null,
            direccion: toTitleCase(finalPatientData.direccion) ?? null,
            telefono: finalProxyData.telefono ?? null,
            correo: proxyAuthEmail,
            nombres: toTitleCase(finalPatientData.nombres) ?? null,
            apellido_paterno: toTitleCase(finalPatientData.apellidoPaterno) ?? null,
            apellido_materno: toTitleCase(finalPatientData.apellidoMaterno) ?? null,
            pais: toTitleCase(finalPatientData.pais) ?? null,
            departamento: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.departamento) ?? null) : null,
            provincia: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.provincia) ?? null) : null,
            distrito: finalPatientData.pais === 'Perú' ? (toTitleCase(finalPatientData.distrito) ?? null) : null,
            estado_cuenta: 'STANDBY',
            id_perfil_propio: null,
            id_apoderado: authId,
            parentesco: toTitleCase(finalProxyData.parentesco) ?? null
          });
        }

        if (!pacienteRes.success) throw new Error(`Error de paciente dependiente: ${pacienteRes.error}`);

        const hcPacienteMostrada = pacienteExistente ? pacienteExistente.numero_hc : patientHC;
        const hcApoderadoMostrada = apoderadoExistente ? apoderadoExistente.numero_hc : proxyHC;
        setSuccessMessage(`¡Registro exitoso! HC Paciente: ${hcPacienteMostrada}, HC Apoderado: ${hcApoderadoMostrada}. Redirigiendo al portal...`);
        sessionStorage.removeItem('is_registering');
        setTimeout(() => {
          resetForm();
          onClose();
          window.location.href = '/dashboard';
        }, 3000);
      }
    } catch (error) {
      sessionStorage.removeItem('is_registering');
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => { resetForm(); onClose(); };

  // Filtrado de Ubigeo para Paciente
  const patientDeptObj = departamentos.find(d => d.name === patientData.departamento);
  const patientDeptId = patientDeptObj ? patientDeptObj.id : '';
  const filteredPatientProvincias = patientDeptId ? provincias.filter(p => p.department_id === patientDeptId) : [];

  const patientProvObj = provincias.find(p => p.name === patientData.provincia && p.department_id === patientDeptId);
  const patientProvId = patientProvObj ? patientProvObj.id : '';
  const filteredPatientDistritos = patientProvId ? distritos.filter(d => d.province_id === patientProvId && d.department_id === patientDeptId) : [];

  // Countries mapped for Nationality selector
  const countryOptions = countries.map(c => ({
    value: c.nameES,
    label: c.nameES,
    flag: <FlagImage iso2={c.iso2} />,
    searchKey: c.nameES
  }));

  // Countries mapped for Phone Prefixes
  const phoneOptions = countries.map(c => ({
    value: `+${c.phoneCode}`,
    label: `+${c.phoneCode}`,
    flag: <FlagImage iso2={c.iso2} />,
    searchKey: `${c.nameES} ${c.phoneCode}`
  }));

  // Grados de instrucción
  const gradoOptions = GRADOS_INSTRUCCION.map(g => ({ value: g, label: g }));

  // Estados civiles
  const estadoCivilOptions = ESTADOS_CIVILES.map(e => ({
    value: e.label,
    label: e.label
  }));

  // Lugar en familia
  const lugarFamiliaOptions = OPTIONS_LUGAR_FAMILIA.map(l => ({ value: l, label: l }));

  // Generos
  const generoOptions = [
    { value: 'Masculino', label: 'Masculino' },
    { value: 'Femenino', label: 'Femenino' }
  ];

  // Tipos documento
  const tipoDocOptions = [
    { value: 'DNI', label: 'DNI' },
    { value: 'Carnet de extranjería', label: 'Carnet de extranjería' }
  ];

  // Departamento options
  const deptoOptions = departamentos.map(d => ({
    value: d.name,
    label: d.name,
    searchKey: d.name
  }));

  // Provincia options
  const provOptions = filteredPatientProvincias.map(p => ({
    value: p.name,
    label: p.name,
    searchKey: p.name
  }));

  // Distrito options
  const distOptions = filteredPatientDistritos.map(d => ({
    value: d.name,
    label: d.name,
    searchKey: d.name
  }));

  // Parentesco options for apoderado
  const parentescoOptions = [
    { value: 'Madre', label: 'Madre' },
    { value: 'Padre', label: 'Padre' },
    { value: 'Tutor', label: 'Tutor' },
    { value: 'Abuelo/a', label: 'Abuelo/a' },
    { value: 'Hermano/a', label: 'Hermano/a' },
    { value: 'Otro', label: 'Otro familiar' }
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="absolute inset-0 bg-[#001d32]/90 backdrop-blur-sm" onClick={handleClose}></div>
      <div className="relative w-full max-w-5xl max-h-[95vh] bg-white rounded-[2.5rem] shadow-2xl overflow-y-auto p-8 md:p-12">

        <header className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-[#003178] uppercase tracking-tighter">Registro de Admisión</h2>
            <p className="text-gray-500 font-medium text-sm">Portal Clínico Especializado</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100" aria-label="Cerrar">
            <span className="material-symbols-outlined font-bold">close</span>
          </button>
        </header>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
              <span className="font-bold">Registro Completado</span>
            </div>
            {successMessage}
          </div>
        )}

        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">error</span>
              {submitError}
            </div>
          </div>
        )}

        {!successMessage && (
          <>
            <nav className="flex gap-4 mb-8 p-1 bg-gray-100 rounded-2xl w-fit">
              <button type="button" onClick={() => handleToggleProxy(false)} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${!isProxy ? 'bg-white text-[#003178] shadow-md' : 'text-gray-400'}`}>PACIENTE</button>
              <button type="button" onClick={() => handleToggleProxy(true)} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${isProxy ? 'bg-white text-[#003178] shadow-md' : 'text-gray-400'}`}>APODERADO / TUTOR</button>
            </nav>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                {/* COLUMNA PACIENTE */}
                <div className="space-y-4">
                  <h3 className="text-[#6cbdfe] font-bold text-xs uppercase tracking-widest border-b pb-2">Datos del Paciente</h3>

                  {/* 1. Nombres, 2. Apellido paterno, 3. Apellido materno */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombres *</label>
                      <input
                        required
                        type="text"
                        placeholder="Nombres"
                        value={patientData.nombres}
                        onChange={(e) => handleNameChange('nombres', e.target.value, true)}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ap. Paterno *</label>
                      <input
                        required
                        type="text"
                        placeholder="Apellido Paterno"
                        value={patientData.apellidoPaterno}
                        onChange={(e) => handleNameChange('apellidoPaterno', e.target.value, true)}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ap. Materno *</label>
                      <input
                        required
                        type="text"
                        placeholder="Apellido Materno"
                        value={patientData.apellidoMaterno}
                        onChange={(e) => handleNameChange('apellidoMaterno', e.target.value, true)}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px]"
                      />
                    </div>
                  </div>

                  {/* 4. Nacionalidad, 5. DNI o CE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nacionalidad *</label>
                      <ComboBox
                        required
                        searchable
                        options={countryOptions}
                        value={patientData.pais}
                        onChange={handlePatientCountryChange}
                        placeholder="Seleccione país"
                        dropdownWidth="250px"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        {patientData.tipoDocumento === 'DNI' ? 'DNI *' : 'Carnet de extranjería *'}
                      </label>
                      <input
                        required
                        type="text"
                        placeholder={patientData.tipoDocumento === 'DNI' ? 'DNI' : 'Documento extranjero'}
                        value={patientData.dni}
                        onChange={(e) => {
                          const limit = patientData.tipoDocumento === 'DNI' ? 8 : 12;
                          const val = e.target.value.replace(/\D/g, '');
                          handlePatientChange('dni', val.slice(0, limit));
                        }}
                        maxLength={patientData.tipoDocumento === 'DNI' ? 8 : 12}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px]"
                      />
                    </div>
                  </div>

                  {/* 6. Fecha de nacimiento, 7. Género */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fec. Nac *</label>
                      <input
                        required
                        type="date"
                        value={patientData.fechaNacimiento}
                        onChange={(e) => handlePatientChange('fechaNacimiento', e.target.value)}
                        min={getMinDate()}
                        max={getTodayDate()}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-500 focus:border-[#003178] transition-colors h-[54px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Género *</label>
                      <ComboBox
                        required
                        options={generoOptions}
                        value={patientData.genero}
                        onChange={(val) => handlePatientChange('genero', val)}
                        placeholder="Seleccione género..."
                      />
                    </div>
                  </div>

                  {/* 8. Dirección */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección *</label>
                    <input
                      required
                      type="text"
                      placeholder="Dirección del domicilio"
                      value={patientData.direccion}
                      onChange={(e) => handlePatientChange('direccion', e.target.value)}
                      className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px]"
                    />
                  </div>

                  {/* Departamento, Provincia, Distrito si el país es Perú */}
                  {patientData.pais === 'Perú' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dpto *</label>
                        <ComboBox
                          required
                          searchable
                          options={deptoOptions}
                          value={patientData.departamento}
                          onChange={handlePatientDepartmentChange}
                          placeholder="Seleccionar..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Provincia *</label>
                        <ComboBox
                          required
                          searchable
                          options={provOptions}
                          value={patientData.provincia}
                          onChange={handlePatientProvinceChange}
                          placeholder="Seleccionar..."
                          disabled={!patientData.departamento}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Distrito *</label>
                        <ComboBox
                          required
                          searchable
                          options={distOptions}
                          value={patientData.distrito}
                          onChange={(val) => handlePatientChange('distrito', val)}
                          placeholder="Seleccionar..."
                          disabled={!patientData.provincia}
                        />
                      </div>
                    </div>
                  )}

                  {/* 9. Lugar en la familia, 10. Estado civil */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lugar en Familia *</label>
                      <ComboBox
                        required
                        options={lugarFamiliaOptions}
                        value={patientData.lugarFamilia}
                        onChange={(val) => handlePatientChange('lugarFamilia', val)}
                        placeholder="Seleccione lugar..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado Civil *</label>
                      <ComboBox
                        required
                        options={estadoCivilOptions}
                        value={patientData.estadoCivil}
                        onChange={(val) => handlePatientChange('estadoCivil', val)}
                        placeholder="Seleccione..."
                      />
                    </div>
                  </div>

                  {/* 11. Grado de instrucción, 12. Ocupación */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Grado Instrucción *</label>
                      <ComboBox
                        required
                        options={gradoOptions}
                        value={patientData.gradoInstruccion}
                        onChange={(val) => handlePatientChange('gradoInstruccion', val)}
                        placeholder="Seleccione..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ocupación *</label>
                      <input
                        required
                        type="text"
                        placeholder="Ocupación"
                        value={patientData.ocupacion}
                        onChange={(e) => handlePatientChange('ocupacion', e.target.value)}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px]"
                      />
                    </div>
                  </div>

                  {/* 13. Correo */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      {isProxy ? "Correo (no necesario)" : "Correo electrónico *"}
                    </label>
                    <input
                      type="email"
                      placeholder="ejemplo@correo.com"
                      value={isProxy ? proxyData.correoReal : patientData.correoReal}
                      onChange={(e) => handlePatientChange('correoReal', e.target.value)}
                      disabled={isProxy}
                      required={!isProxy}
                      className={`w-full px-4 border rounded-2xl outline-none text-sm h-[54px] focus:border-[#003178] transition-colors ${
                        isProxy ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-blue-50/50 border-gray-200'
                      }`}
                    />
                    {!isProxy && (
                      <p className="text-[10px] text-gray-400 mt-1 ml-2 leading-tight">
                        Se usará para validación de la cuenta. El acceso será con tu DNI.
                      </p>
                    )}
                  </div>

                  {/* 14. Celular */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      {isProxy ? "Celular (no necesario)" : "Celular *"}
                    </label>
                    {isProxy ? (
                      <input
                        disabled
                        type="text"
                        placeholder="Celular (no necesario)"
                        className="w-full px-4 bg-gray-200 border border-gray-200 rounded-2xl outline-none text-sm text-gray-400 cursor-not-allowed h-[54px]"
                      />
                    ) : (
                      <div className="flex gap-2 w-full">
                        <div className="w-36 shrink-0">
                          <ComboBox
                            options={phoneOptions}
                            value={patientPhonePrefix}
                            onChange={(val) => {
                              setPatientPhonePrefix(val);
                              if (val === '+51') {
                                setPatientPhoneNumber(prev => prev.slice(0, 9));
                              }
                            }}
                            searchable
                            placeholder="+51"
                          />
                        </div>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          value={patientPhoneNumber}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            const limit = patientPhonePrefix === '+51' ? 9 : 15;
                            setPatientPhoneNumber(val.slice(0, limit));
                          }}
                          placeholder="Número de celular"
                          className="flex-1 px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px]"
                          maxLength={patientPhonePrefix === '+51' ? 9 : 15}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className={`space-y-4 transition-all duration-500 ${isProxy ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <h3 className="text-[#003178] font-bold text-xs uppercase tracking-widest border-b pb-2">Datos del Apoderado</h3>

                  {/* Fila 1: Nombres, Apellido Paterno, Apellido Materno */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombres *</label>
                      <input
                        required={isProxy}
                        disabled={!isProxy}
                        type="text"
                        placeholder="Nombres"
                        value={proxyData.nombres}
                        onChange={(e) => handleNameChange('nombres', e.target.value, false)}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px] disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ap. Paterno *</label>
                      <input
                        required={isProxy}
                        disabled={!isProxy}
                        type="text"
                        placeholder="Apellido Paterno"
                        value={proxyData.apellidoPaterno}
                        onChange={(e) => handleNameChange('apellidoPaterno', e.target.value, false)}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px] disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ap. Materno *</label>
                      <input
                        required={isProxy}
                        disabled={!isProxy}
                        type="text"
                        placeholder="Apellido Materno"
                        value={proxyData.apellidoMaterno}
                        onChange={(e) => handleNameChange('apellidoMaterno', e.target.value, false)}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px] disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Fila 2: Documento, Fecha Nacimiento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">DNI / CE *</label>
                      <input
                        required={isProxy}
                        disabled={!isProxy}
                        type="text"
                        placeholder="Documento (8-12 dígitos)"
                        value={proxyData.dni}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const limit = 12;
                          const cleanedVal = val.slice(0, limit);
                          setProxyData(prev => ({
                            ...prev,
                            dni: cleanedVal,
                            tipoDocumento: cleanedVal.length === 8 ? 'DNI' : 'Carnet de extranjería'
                          }));
                        }}
                        maxLength={12}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px] disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fec. Nac *</label>
                      <input
                        required={isProxy}
                        disabled={!isProxy}
                        type="date"
                        value={proxyData.fechaNacimiento}
                        onChange={(e) => handleProxyChange('fechaNacimiento', e.target.value)}
                        min={getMinDate()}
                        max={getTodayDate()}
                        className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-500 focus:border-[#003178] transition-colors h-[54px] disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Fila 3: Género, Parentesco */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Género *</label>
                      <ComboBox
                        required={isProxy}
                        disabled={!isProxy}
                        options={generoOptions}
                        value={proxyData.genero}
                        onChange={(val) => handleProxyChange('genero', val)}
                        placeholder="Género *"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Parentesco *</label>
                      <ComboBox
                        required={isProxy}
                        disabled={!isProxy}
                        options={parentescoOptions}
                        value={proxyData.parentesco}
                        onChange={(val) => handleProxyChange('parentesco', val)}
                        placeholder="Parentesco *"
                      />
                    </div>
                  </div>

                  {/* Fila 4: Correo Electrónico y Celular */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electrónico *</label>
                    <input
                      required={isProxy}
                      disabled={!isProxy}
                      type="email"
                      placeholder="ejemplo@correo.com"
                      value={proxyData.correoReal}
                      onChange={(e) => handleProxyChange('correoReal', e.target.value)}
                      className="w-full px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-700 focus:border-[#003178] transition-colors h-[54px] disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Celular *</label>
                    {isProxy ? (
                      <div className="flex gap-2 w-full">
                        <div className="w-36 shrink-0">
                          <ComboBox
                            options={phoneOptions}
                            value={proxyPhonePrefix}
                            onChange={(val) => {
                              setProxyPhonePrefix(val);
                              if (val === '+51') {
                                setProxyPhoneNumber(prev => prev.slice(0, 9));
                              }
                            }}
                            searchable
                            placeholder="+51"
                          />
                        </div>
                        <input
                          required={isProxy}
                          disabled={!isProxy}
                          type="text"
                          inputMode="numeric"
                          value={proxyPhoneNumber}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            const limit = proxyPhonePrefix === '+51' ? 9 : 15;
                            setProxyPhoneNumber(val.slice(0, limit));
                          }}
                          placeholder="Número de celular"
                          className="flex-1 px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-sm text-gray-750 focus:border-[#003178] transition-colors h-[54px]"
                          maxLength={proxyPhonePrefix === '+51' ? 9 : 15}
                        />
                      </div>
                    ) : (
                      <input
                        disabled
                        type="text"
                        placeholder="Celular"
                        className="w-full px-4 bg-gray-200 border border-gray-200 rounded-2xl outline-none text-sm text-gray-400 cursor-not-allowed h-[54px]"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-gray-500 font-bold text-xs uppercase mb-4 tracking-widest">Credenciales de Acceso</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ValidatedInput type="password" placeholder="Contraseña *" required value={password} onChange={handlePasswordChange} error={passwordError} helpText="Mín. 8 caracteres, 1 mayúscula, 1 símbolo (. @ ! # $ % &)" className="w-full p-4 bg-blue-50/50 border rounded-2xl outline-none text-sm font-bold" />
                  <ValidatedInput type="password" placeholder="Confirmar Contraseña *" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={confirmPassword && password !== confirmPassword ? 'Las contraseñas no coinciden' : ''} className="w-full p-4 bg-blue-50/50 border rounded-2xl outline-none text-sm font-bold" />
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-[#003178] text-white font-black rounded-2xl shadow-xl hover:bg-blue-900 transition-all uppercase tracking-widest text-xs hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? (<span className="flex items-center justify-center gap-2"><span className="material-symbols-outlined animate-spin text-sm">sync</span> Registrando...</span>) : 'Finalizar Registro'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default RegisterModal;