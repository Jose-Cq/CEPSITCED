import { useState, useEffect } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { registrarPaciente, actualizarPaciente, obtenerUltimoNumeroHC } from '../utils/supabaseHelpers';
import { generarNumeroHC } from '../utils/generateHC';
import { supabase } from '../supabaseClient';
import { GRADOS_INSTRUCCION, ESTADOS_CIVILES } from '../constants/formOptions';

import countries from '../data/countries.json';
import departamentos from '../data/ubigeo_peru_2016_departamentos.json';
import provincias from '../data/ubigeo_peru_2016_provincias.json';
import distritos from '../data/ubigeo_peru_2016_distritos.json';

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


const parseTelefono = (telString) => {
  if (!telString) return { prefix: '+51', number: '' };
  const match = telString.match(/^(\+\d+)\s*(.*)$/);
  if (match) {
    return { prefix: match[1], number: match[2] };
  }
  return { prefix: '+51', number: telString };
};

const Profile = ({ onNavigate }) => {
  const { loading, perfilUsuario, perfilClinicoPropio, refetch } = usePacienteActual();
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Teléfono prefijo e input
  const [phonePrefix, setPhonePrefix] = useState('+51');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Estado para la ficha clínica
  const [clinicalData, setClinicalData] = useState({
    genero: '',
    direccion: '',
    pais: 'Perú',
    departamento: '',
    provincia: '',
    distrito: '',
    lugar_familia: '',
    estado_civil: '',
    grado_instruccion: '',
    ocupacion: '',
    telefono: '',
    correo: ''
  });

  const [isEditing, setIsEditing] = useState(false);

  // Inicializar formulario con datos existentes
  useEffect(() => {
    if (perfilClinicoPropio) {
      const parsed = parseTelefono(perfilClinicoPropio.telefono);
      setPhonePrefix(parsed.prefix);
      setPhoneNumber(parsed.number);

      const userEmail = (perfilClinicoPropio.correo || '').toLowerCase().includes('@sistema.cepsitced.local') 
        ? '' 
        : (perfilClinicoPropio.correo || '');

      setClinicalData({
        genero: perfilClinicoPropio.genero || '',
        direccion: perfilClinicoPropio.direccion || '',
        pais: perfilClinicoPropio.pais || 'Perú',
        departamento: perfilClinicoPropio.departamento || '',
        provincia: perfilClinicoPropio.provincia || '',
        distrito: perfilClinicoPropio.distrito || '',
        lugar_familia: perfilClinicoPropio.lugar_familia || '',
        estado_civil: perfilClinicoPropio.estado_civil || '',
        grado_instruccion: perfilClinicoPropio.grado_instruccion || '',
        ocupacion: perfilClinicoPropio.ocupacion || '',
        telefono: perfilClinicoPropio.telefono || '',
        correo: userEmail
      });
    } else if (perfilUsuario) {
      const parsed = parseTelefono(perfilUsuario.telefono);
      setPhonePrefix(parsed.prefix);
      setPhoneNumber(parsed.number);

      const userEmail = (perfilUsuario.correo || '').toLowerCase().includes('@sistema.cepsitced.local') 
        ? '' 
        : (perfilUsuario.correo || '');

      setClinicalData(prev => ({
        ...prev,
        telefono: perfilUsuario.telefono || '',
        correo: userEmail
      }));
    }
  }, [perfilClinicoPropio, perfilUsuario]);

  // Entrar automáticamente en modo de edición si no existe perfil clínico propio
  useEffect(() => {
    if (!loading && !perfilClinicoPropio && perfilUsuario) {
      setIsEditing(true);
    }
  }, [loading, perfilClinicoPropio, perfilUsuario]);

  // Validar si la ficha clínica está incompleta
  const esFichaIncompleta = () => {
    if (!perfilClinicoPropio) return true;
    if (!perfilClinicoPropio.genero || !perfilClinicoPropio.direccion || !perfilClinicoPropio.pais) return true;
    if (perfilClinicoPropio.pais === 'Perú' && (!perfilClinicoPropio.departamento || !perfilClinicoPropio.provincia || !perfilClinicoPropio.distrito)) {
      return true;
    }
    return false;
  };

  const handleFieldChange = (field, value) => {
    setClinicalData(prev => ({ ...prev, [field]: value }));
  };

  const handleCountryChange = (val) => {
    setClinicalData(prev => ({
      ...prev,
      pais: val,
      departamento: '',
      provincia: '',
      distrito: ''
    }));

    const cObj = countries.find(c => c.nameES === val);
    if (cObj) {
      setPhonePrefix(`+${cObj.phoneCode}`);
    }
  };

  const handleDepartmentChange = (deptName) => {
    setClinicalData(prev => ({
      ...prev,
      departamento: deptName,
      provincia: '',
      distrito: ''
    }));
  };

  const handleProvinceChange = (provName) => {
    setClinicalData(prev => ({
      ...prev,
      provincia: provName,
      distrito: ''
    }));
  };

  const handleSaveClinicalProfile = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSaving(true);

    try {
      // Validaciones obligatorias
      if (!clinicalData.genero || !clinicalData.direccion || !clinicalData.pais) {
        throw new Error('Género, Dirección y País son campos obligatorios (*).');
      }
      if (clinicalData.pais === 'Perú' && (!clinicalData.departamento || !clinicalData.provincia || !clinicalData.distrito)) {
        throw new Error('Departamento, provincia y distrito son campos obligatorios para Perú.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // Validar celular si se ingresó
      if (phoneNumber) {
        const digits = phoneNumber.replace(/\D/g, '');
        if (phonePrefix === '+51') {
          if (digits.length !== 9) {
            throw new Error('El celular para Perú (+51) debe tener exactamente 9 dígitos.');
          }
        } else {
          if (digits.length < 5 || digits.length > 15) {
            throw new Error('El celular debe tener entre 5 y 15 dígitos.');
          }
        }
      }

      const telefonoCompleto = phoneNumber ? `${phonePrefix} ${phoneNumber.trim()}`.trim() : null;

      // Buscar si existe un registro en pacientes con id_perfil_propio = user.id
      const { data: pacienteExistente, error: pacienteExistenteError } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id_perfil_propio', user.id)
        .maybeSingle();

      if (pacienteExistenteError) {
        throw new Error(`Error al verificar ficha clínica en pacientes: ${pacienteExistenteError.message}`);
      }

      const pacienteIdToUpdate = perfilClinicoPropio?.id_paciente || pacienteExistente?.id_paciente;

      if (pacienteIdToUpdate) {
        // --- CASO: ACTUALIZAR REGISTRO CLÍNICO EXISTENTE ---
        // Validar campos obligatorios para actualización
        if (!clinicalData.genero) throw new Error('El género es obligatorio.');
        if (!clinicalData.direccion) throw new Error('La dirección es obligatoria.');
        if (!clinicalData.pais) throw new Error('El país es obligatorio.');

        const res = await actualizarPaciente(pacienteIdToUpdate, {
          genero: clinicalData.genero,
          direccion: clinicalData.direccion ?? null,
          pais: clinicalData.pais ?? null,
          departamento: clinicalData.pais === 'Perú' ? (clinicalData.departamento ?? null) : null,
          provincia: clinicalData.pais === 'Perú' ? (clinicalData.provincia ?? null) : null,
          distrito: clinicalData.pais === 'Perú' ? (clinicalData.distrito ?? null) : null,
          lugar_familia: clinicalData.lugar_familia ?? null,
          estado_civil: clinicalData.estado_civil ?? null,
          grado_instruccion: clinicalData.grado_instruccion ?? null,
          ocupacion: clinicalData.ocupacion ?? null,
          telefono: telefonoCompleto ?? null,
          correo: clinicalData.correo ?? null,
          id_perfil_propio: user.id
        });

        if (!res.success) throw new Error(res.error || 'Error al actualizar la ficha clínica.');
      } else {
        // --- CASO: CREACIÓN AUTOMÁTICA DE FICHA CLÍNICA ---
        const ultimoHC = await obtenerUltimoNumeroHC();
        const { numeroHC } = generarNumeroHC(
          perfilUsuario.fecha_nacimiento,
          clinicalData.genero,
          ultimoHC
        );

        // Validar obligatorios antes de insertar
        if (!numeroHC) throw new Error('Error al generar la Historia Clínica.');
        if (!perfilUsuario.dni) throw new Error('El DNI del usuario es obligatorio.');
        if (!perfilUsuario.nombres) throw new Error('Los nombres del usuario son obligatorios.');
        if (!perfilUsuario.apellido_paterno) throw new Error('El apellido paterno del usuario es obligatorio.');
        if (!perfilUsuario.apellido_materno) throw new Error('El apellido materno del usuario es obligatorio.');
        if (!perfilUsuario.fecha_nacimiento) throw new Error('La fecha de nacimiento del usuario es obligatoria.');
        if (!clinicalData.genero) throw new Error('El género es obligatorio.');
        if (!clinicalData.direccion) throw new Error('La dirección es obligatoria.');
        if (!clinicalData.pais) throw new Error('El país es obligatorio.');

        const res = await registrarPaciente({
          numero_hc: numeroHC,
          dni: perfilUsuario.dni,
          nombres: perfilUsuario.nombres ?? null,
          apellido_paterno: perfilUsuario.apellido_paterno ?? null,
          apellido_materno: perfilUsuario.apellido_materno ?? null,
          fecha_nacimiento: perfilUsuario.fecha_nacimiento,
          genero: clinicalData.genero,
          direccion: clinicalData.direccion ?? null,
          pais: clinicalData.pais ?? null,
          departamento: clinicalData.pais === 'Perú' ? (clinicalData.departamento ?? null) : null,
          provincia: clinicalData.pais === 'Perú' ? (clinicalData.provincia ?? null) : null,
          distrito: clinicalData.pais === 'Perú' ? (clinicalData.distrito ?? null) : null,
          lugar_familia: clinicalData.lugar_familia ?? null,
          estado_civil: clinicalData.estado_civil ?? null,
          grado_instruccion: clinicalData.grado_instruccion ?? null,
          ocupacion: clinicalData.ocupacion ?? null,
          telefono: telefonoCompleto ?? null,
          correo: clinicalData.correo ?? null,
          estado_cuenta: 'INDEPENDIENTE',
          id_perfil_propio: user.id,
          id_apoderado: null
        });

        if (!res.success) throw new Error(res.error || 'Error al crear la ficha clínica.');
      }

      alert('Datos de perfil actualizados exitosamente.');
      setIsEditing(false);
      refetch();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (!perfilUsuario) return '?';
    const n = perfilUsuario.nombres?.charAt(0) || '';
    const a = perfilUsuario.apellido_paterno?.charAt(0) || '';
    return (n + a).toUpperCase();
  };

  if (loading) {
    return (
      <DashboardLayout currentPath="/dashboard/profile" onNavigate={onNavigate}>
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  const fichaIncompleta = esFichaIncompleta();

  // Filtrado de Ubigeo
  const deptObj = departamentos.find(d => d.name === clinicalData.departamento);
  const deptId = deptObj ? deptObj.id : '';
  const filteredProvincias = deptId ? provincias.filter(p => p.department_id === deptId) : [];

  const provObj = provincias.find(p => p.name === clinicalData.provincia && p.department_id === deptId);
  const provId = provObj ? provObj.id : '';
  const filteredDistritos = provId ? distritos.filter(d => d.province_id === provId && d.department_id === deptId) : [];

  // País flag actual
  const countryObj = countries.find(c => c.nameES === clinicalData.pais);

  // Prefijo flag actual
  const prefixObj = countries.find(c => `+${c.phoneCode}` === phonePrefix);

  return (
    <DashboardLayout currentPath="/dashboard/profile" onNavigate={onNavigate}>
      <div className="max-w-6xl mx-auto font-['Manrope']">
        {/* Encabezado y Alerta de Ficha Incompleta */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Mi Perfil</h1>
            <p className="text-gray-500 text-sm">
              Administra tus datos de usuario, de contacto y tu Ficha Clínica personal.
            </p>
          </div>

          {/* Alerta roja flotante si la ficha clínica es incompleta o no existe */}
          {fichaIncompleta && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-2.5 max-w-md shadow-sm self-stretch md:self-auto animate-fade-in-up">
              <span className="material-symbols-outlined text-red-500 text-[20px] shrink-0 mt-0.5">warning</span>
              <div>
                <p className="text-xs font-bold text-red-800 uppercase tracking-wide">Ficha Clínica Incompleta</p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">
                  Completa tu dirección y datos de localización en la ficha clínica para poder agendar citas para ti mismo.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Columna Izquierda: Información de Cuenta y Ficha Clínica */}
          <div className="lg:col-span-8 space-y-8">

            {/* Tarjeta de Cuenta */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 md:p-8 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-[#003178] text-white flex items-center justify-center text-2xl font-bold shadow-md">
                  {getInitials()}
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h2 className="text-2xl font-black text-gray-900 leading-tight">
                    {perfilUsuario?.nombres} {perfilUsuario?.apellido_paterno} {perfilUsuario?.apellido_materno}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-gray-400">badge</span>
                      DNI: {perfilUsuario?.dni}
                    </span>
                    {perfilClinicoPropio && (
                      <span className="flex items-center gap-1 text-[#003178] font-bold">
                        <span className="material-symbols-outlined text-[16px]">clinical_notes</span>
                        HC: {perfilClinicoPropio.numero_hc}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Formulario de Ficha Clínica */}
              <form onSubmit={handleSaveClinicalProfile} className="p-6 md:p-8 space-y-6">

                {submitError && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500">error</span>
                    {submitError}
                  </div>
                )}

                {/* Subsección: Datos Clínicos */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-xs font-bold text-[#003178] uppercase tracking-widest">
                      Ficha Clínica y Localización
                    </h3>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-xs font-bold text-[#003178] hover:text-blue-900 flex items-center gap-1 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar Ficha
                      </button>
                    )}
                  </div>

                  {!perfilClinicoPropio && !isEditing && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-center">
                      <p className="text-sm text-gray-600 mb-3">
                        Aún no has creado tu ficha clínica personal.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="bg-[#003178] hover:bg-blue-900 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
                      >
                        Crear Ficha Clínica Ahora
                      </button>
                    </div>
                  )}

                  {(perfilClinicoPropio || isEditing) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Género */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Género *</label>
                        {isEditing ? (
                          <select
                            value={clinicalData.genero}
                            onChange={e => handleFieldChange('genero', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600 bg-white"
                          >
                            <option value="">Seleccionar género...</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Femenino">Femenino</option>
                          </select>
                        ) : (
                          <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.genero || '-'}</p>
                        )}
                      </div>

                      {/* País */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">País *</label>
                        {isEditing ? (
                          <select
                            value={clinicalData.pais}
                            onChange={e => handleCountryChange(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-700 bg-white"
                          >
                            {countries.map(c => (
                              <option key={c.iso2} value={c.nameES}>
                                {getFlagEmoji(c.iso2)} {c.nameES}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700 flex items-center gap-2">
                            <FlagImage iso2={countryObj?.iso2} />
                            <span>{clinicalData.pais || '-'}</span>
                          </p>
                        )}
                      </div>

                      {/* Dirección */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección *</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={clinicalData.direccion}
                            onChange={e => handleFieldChange('direccion', e.target.value)}
                            placeholder="Dirección del domicilio"
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                          />
                        ) : (
                          <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.direccion || '-'}</p>
                        )}
                      </div>

                      {/* UBIGEO Peruano */}
                      {clinicalData.pais === 'Perú' && (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Departamento *</label>
                            {isEditing ? (
                              <select
                                required
                                value={clinicalData.departamento}
                                onChange={e => handleDepartmentChange(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                              >
                                <option value="">Seleccionar...</option>
                                {departamentos.map(d => (
                                  <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.departamento || '-'}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Provincia *</label>
                            {isEditing ? (
                              <select
                                required
                                value={clinicalData.provincia}
                                onChange={e => handleProvinceChange(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                                disabled={!clinicalData.departamento}
                              >
                                <option value="">Seleccionar...</option>
                                {filteredProvincias.map(p => (
                                  <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.provincia || '-'}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Distrito *</label>
                            {isEditing ? (
                              <select
                                required
                                value={clinicalData.distrito}
                                onChange={e => handleFieldChange('distrito', e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                                disabled={!clinicalData.provincia}
                              >
                                <option value="">Seleccionar...</option>
                                {filteredDistritos.map(d => (
                                  <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.distrito || '-'}</p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Lugar en la familia */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lugar en la Familia</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={clinicalData.lugar_familia}
                            onChange={e => handleFieldChange('lugar_familia', e.target.value)}
                            placeholder="Hijo mayor, etc."
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                          />
                        ) : (
                          <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.lugar_familia || '-'}</p>
                        )}
                      </div>

                      {/* Estado Civil */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado Civil</label>
                        {isEditing ? (
                          <select
                            value={clinicalData.estado_civil}
                            onChange={e => handleFieldChange('estado_civil', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600 bg-white"
                          >
                            <option value="">Seleccionar...</option>
                            {ESTADOS_CIVILES.map(e => (
                              <option key={e.val} value={e.label}>{e.label}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.estado_civil || '-'}</p>
                        )}
                      </div>

                      {/* Grado Instrucción */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Grado de Instrucción</label>
                        {isEditing ? (
                          <select
                            value={clinicalData.grado_instruccion}
                            onChange={e => handleFieldChange('grado_instruccion', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600 bg-white"
                          >
                            <option value="">Seleccionar...</option>
                            {GRADOS_INSTRUCCION.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        ) : (
                          <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.grado_instruccion || '-'}</p>
                        )}
                      </div>

                      {/* Ocupación */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ocupación</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={clinicalData.ocupacion}
                            onChange={e => handleFieldChange('ocupacion', e.target.value)}
                            placeholder="Ocupación / Trabajo"
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                          />
                        ) : (
                          <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">{clinicalData.ocupacion || '-'}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Subsección: Contacto */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Información de Contacto
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Celular / Teléfono</label>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <select
                            value={phonePrefix}
                            onChange={e => setPhonePrefix(e.target.value)}
                            className="p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-gray-50 text-gray-700 w-28 shrink-0"
                          >
                            {countries.map(c => (
                              <option key={c.iso2} value={`+${c.phoneCode}`}>
                                {getFlagEmoji(c.iso2)} +{c.phoneCode}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={phoneNumber}
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, '');
                              setPhoneNumber(val.slice(0, 15));
                            }}
                            maxLength={15}
                            placeholder="Celular"
                            className="flex-1 p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                          />
                        </div>
                      ) : (
                        <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700 flex items-center gap-2">
                          <FlagImage iso2={prefixObj?.iso2} />
                          <span>{phonePrefix} {phoneNumber || '-'}</span>
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo de Contacto</label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={clinicalData.correo}
                          onChange={e => handleFieldChange('correo', e.target.value)}
                          placeholder="tucorreo@ejemplo.com"
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none animate-fade-in"
                        />
                      ) : (
                        <p className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-750 font-medium font-mono break-all select-all">
                          {clinicalData.correo || '-'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones de Guardar */}
                {isEditing && (
                  <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        refetch();
                      }}
                      className="px-4 py-2 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 text-sm font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-[#003178] hover:bg-blue-900 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? 'Guardando...' : 'Guardar Ficha Clínica'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Columna Derecha: Información Adicional */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3 text-[#003178]">
                <span className="material-symbols-outlined">security</span>
                <h4 className="font-bold text-sm">Políticas de Privacidad</h4>
              </div>
              <p className="text-gray-600 text-xs leading-relaxed">
                Tus datos clínicos y de contacto están debidamente protegidos bajo las regulaciones nacionales de salud mental. La confidencialidad es de carácter absoluto.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;