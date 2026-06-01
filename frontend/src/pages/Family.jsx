import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { usePacienteActual } from '../hooks/usePacienteActual';
import { registrarPaciente, obtenerUltimoNumeroHC } from '../utils/supabaseHelpers';
import { calcularEdad, generarNumeroHC } from '../utils/generateHC';
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

const Family = ({ onNavigate }) => {
  const { loading, perfilesDependientes, refetch } = usePacienteActual();
  const [filterRelative, setFilterRelative] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Paso del wizard en el modal
  const [wizardStep, setWizardStep] = useState(1);

  // Prefijo telefónico separado en UI
  const [phonePrefix, setPhonePrefix] = useState('+51');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Datos del nuevo perfil dependiente
  const [newProfile, setNewProfile] = useState({
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    dni: '',
    fechaNacimiento: '',
    genero: '',
    parentesco: '',
    direccion: '',
    pais: 'Perú',
    departamento: '',
    provincia: '',
    distrito: '',
    lugarFamilia: '',
    estadoCivil: '',
    gradoInstruccion: '',
    ocupacion: '',
    correo: '',
    tipoDocumento: 'DNI'
  });

  const handleOpenAddModal = async () => {
    // Intentar traer la dirección, país y ubigeo del usuario logueado para autocompletar
    let dirDefecto = '';
    let paisDefecto = 'Perú';
    let deptDefecto = '';
    let provDefecto = '';
    let distDefecto = '';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: pacientePropio } = await supabase
          .from('pacientes')
          .select('direccion, pais, departamento, provincia, distrito')
          .eq('id_perfil_propio', user.id)
          .maybeSingle();
        if (pacientePropio) {
          dirDefecto = pacientePropio.direccion || '';
          paisDefecto = pacientePropio.pais || 'Perú';
          deptDefecto = pacientePropio.departamento || '';
          provDefecto = pacientePropio.provincia || '';
          distDefecto = pacientePropio.distrito || '';
        }
      }
    } catch (e) {
      console.error(e);
    }

    setNewProfile({
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      dni: '',
      fechaNacimiento: '',
      genero: '',
      parentesco: '',
      direccion: dirDefecto,
      pais: paisDefecto,
      departamento: deptDefecto,
      provincia: provDefecto,
      distrito: distDefecto,
      lugarFamilia: '',
      estadoCivil: '',
      gradoInstruccion: '',
      ocupacion: '',
      correo: '',
      tipoDocumento: paisDefecto === 'Perú' ? 'DNI' : 'Carnet de extranjería'
    });

    setPhonePrefix('+51');
    setPhoneNumber('');
    setWizardStep(1);
    setSubmitError('');
    setIsAddModalOpen(true);
  };

  const handleLimitInput = (e, limit, field) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= limit) {
      setNewProfile(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleChange = (field, value) => {
    setNewProfile(prev => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
    setPhoneNumber(val);
  };

  const handleCountryChange = (val) => {
    setNewProfile(prev => ({
      ...prev,
      pais: val,
      departamento: '',
      provincia: '',
      distrito: '',
      tipoDocumento: val === 'Perú' ? 'DNI' : 'Carnet de extranjería'
    }));

    // Sincronizar prefijo de teléfono por defecto para Perú
    const cObj = countries.find(c => c.nameES === val);
    if (cObj) {
      setPhonePrefix(`+${cObj.phoneCode}`);
    }
  };

  const handleDepartmentChange = (deptName) => {
    setNewProfile(prev => ({
      ...prev,
      departamento: deptName,
      provincia: '',
      distrito: ''
    }));
  };

  const handleProvinceChange = (provName) => {
    setNewProfile(prev => ({
      ...prev,
      provincia: provName,
      distrito: ''
    }));
  };


  const edad = newProfile.fechaNacimiento ? calcularEdad(newProfile.fechaNacimiento) : null;
  const esMenor = edad !== null && edad < 18;

  const validateStep = (stepNum) => {
    if (stepNum === 1) {
      if (!newProfile.nombres || !newProfile.apellidoPaterno || !newProfile.apellidoMaterno || !newProfile.genero || !newProfile.fechaNacimiento || !newProfile.dni) {
        return 'Completa todos los campos obligatorios de datos personales (*).';
      }
      if (newProfile.tipoDocumento === 'DNI' && newProfile.dni.length !== 8) {
        return 'El DNI debe tener exactamente 8 dígitos.';
      }
      if (newProfile.tipoDocumento !== 'DNI' && newProfile.dni.length < 12) {
        return 'El Carnet de extranjería debe tener al menos 12 caracteres.';
      }
    }
    if (stepNum === 2) {
      if (!newProfile.pais || !newProfile.direccion) {
        return 'La dirección y el país son obligatorios.';
      }
      if (newProfile.pais === 'Perú' && (!newProfile.departamento || !newProfile.provincia || !newProfile.distrito)) {
        return 'El departamento, provincia y distrito son obligatorios para Perú.';
      }
    }
    if (stepNum === 3) {
      if (!newProfile.parentesco || !newProfile.lugarFamilia || !newProfile.estadoCivil || !newProfile.gradoInstruccion || !newProfile.ocupacion) {
        return 'Completa todos los campos obligatorios (*): Vínculo, Lugar en la familia, Estado civil, Grado de instrucción y Ocupación.';
      }
    }
    if (stepNum === 4) {
      if (!esMenor) {
        if (!phoneNumber) {
          return 'El celular es obligatorio para mayores de edad.';
        }
        if (!newProfile.correo || !newProfile.correo.includes('@')) {
          return 'El correo electrónico es obligatorio y debe ser válido.';
        }
      }
    }
    return '';
  };

  const handleNext = () => {
    const error = validateStep(wizardStep);
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError('');
    setWizardStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setSubmitError('');
    setWizardStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    // Validar todos los pasos
    for (let i = 1; i <= 4; i++) {
      const err = validateStep(i);
      if (err) {
        setSubmitError(`Paso ${i}: ${err}`);
        setWizardStep(i);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      // 1. Verificar si el DNI del dependiente ya existe
      const { data: duplicado } = await supabase
        .from('pacientes')
        .select('id_paciente')
        .eq('dni', newProfile.dni)
        .maybeSingle();

      if (duplicado) {
        throw new Error('Este número de documento ya se encuentra registrado en el sistema.');
      }

      // 2. Obtener el último número de historia clínica
      const ultimoHC = await obtenerUltimoNumeroHC();

      // 3. Generar número de HC
      const { numeroHC } = generarNumeroHC(
        newProfile.fechaNacimiento,
        newProfile.genero,
        ultimoHC
      );

      const telefonoCompleto = phoneNumber ? `${phonePrefix} ${phoneNumber.trim()}`.trim() : null;

      // 4. Registrar en la tabla pacientes
      const res = await registrarPaciente({
        numero_hc: numeroHC,
        dni: newProfile.dni,
        nombres: newProfile.nombres,
        apellido_paterno: newProfile.apellidoPaterno,
        apellido_materno: newProfile.apellidoMaterno,
        fecha_nacimiento: newProfile.fechaNacimiento,
        genero: newProfile.genero,
        direccion: newProfile.direccion,
        parentesco: newProfile.parentesco,
        estado_cuenta: 'STANDBY',
        id_perfil_propio: null,
        id_apoderado: user.id,
        pais: newProfile.pais,
        departamento: newProfile.pais === 'Perú' ? newProfile.departamento : null,
        provincia: newProfile.pais === 'Perú' ? newProfile.provincia : null,
        distrito: newProfile.pais === 'Perú' ? newProfile.distrito : null,
        lugar_familia: newProfile.lugarFamilia || null,
        estado_civil: newProfile.estadoCivil || null,
        grado_instruccion: newProfile.gradoInstruccion || null,
        ocupacion: newProfile.ocupacion || null,
        telefono: telefonoCompleto,
        correo: newProfile.correo || null
      });

      if (!res.success) {
        throw new Error(res.error || 'Error al guardar el perfil.');
      }

      alert('Perfil registrado exitosamente.');
      setIsAddModalOpen(false);
      refetch(); // Recargar datos
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFilteredRelatives = () => {
    if (filterRelative === 'all') return perfilesDependientes;
    return perfilesDependientes.filter(r => r.id_paciente === filterRelative);
  };

  const filteredRelatives = getFilteredRelatives();

  // Filtrado de Ubigeo
  const deptObj = departamentos.find(d => d.name === newProfile.departamento);
  const deptId = deptObj ? deptObj.id : '';
  const filteredProvincias = deptId ? provincias.filter(p => p.department_id === deptId) : [];

  const provObj = provincias.find(p => p.name === newProfile.provincia && p.department_id === deptId);
  const provId = provObj ? provObj.id : '';
  const filteredDistritos = provId ? distritos.filter(d => d.province_id === provId && d.department_id === deptId) : [];

  return (
    <DashboardLayout currentPath="/dashboard/family font-['Manrope']">
      {/* Encabezado de página */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Perfiles de la Cuenta</h2>
          <p className="text-gray-500 text-lg max-w-2xl">
            Gestiona los perfiles clínicos de tus hijos, familiares o dependientes para agendar sus citas.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-[#003178] text-white rounded-lg px-5 py-2.5 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-900 transition-all shadow-sm active:scale-[0.98] shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Agregar Perfil
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Cargando perfiles...</span>
        </div>
      ) : (
        <>
          {/* Sección de filtro */}
          {perfilesDependientes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400 text-[18px]">filter_list</span>
                Filtrar perfiles:
              </label>
              <select
                className="bg-gray-50 border border-gray-200 rounded-md px-4 py-2 text-sm text-gray-700 focus:border-[#003178] focus:ring-1 focus:ring-[#003178] outline-none transition-colors w-full sm:w-auto min-w-[200px]"
                value={filterRelative}
                onChange={(e) => setFilterRelative(e.target.value)}
              >
                <option value="all">Todos los perfiles dependientes</option>
                {perfilesDependientes.map(r => (
                  <option key={r.id_paciente} value={r.id_paciente}>
                    {r.nombres} {r.apellido_paterno} ({r.parentesco})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cuadrícula de perfiles */}
          {filteredRelatives.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
              <span className="material-symbols-outlined text-gray-300 text-6xl mb-4">groups</span>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Sin perfiles dependientes</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                Aún no has registrado perfiles para tus familiares. Puedes agregar hijos o personas a tu cargo para agendar sus citas.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 bg-[#003178] hover:bg-blue-900 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Crear Primer Perfil
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredRelatives.map((relative) => {
                const nombreCompleto = `${relative.nombres} ${relative.apellido_paterno} ${relative.apellido_materno || ''}`.trim();
                const iniciales = `${relative.nombres?.charAt(0) || ''}${relative.apellido_paterno?.charAt(0) || ''}`.toUpperCase();
                const edadCalculada = calcularEdad(relative.fecha_nacimiento);

                return (
                  <div key={relative.id_paciente} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden flex flex-col group relative">
                    {/* Encabezado de la tarjeta */}
                    <div className="p-6 border-b border-gray-100 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-blue-50 text-[#003178] flex items-center justify-center text-xl font-bold uppercase border border-blue-100">
                        {iniciales}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-[#003178] transition-colors leading-tight">
                          {nombreCompleto}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-[#003178] text-xs font-semibold">
                          {relative.parentesco}
                        </span>
                      </div>
                    </div>

                    {/* Cuerpo de la tarjeta */}
                    <div className="p-6 bg-gray-50 flex-1 flex flex-col justify-between">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Documento</p>
                          <p className="text-sm text-gray-900 font-semibold">{relative.dni}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Edad</p>
                          <p className="text-sm text-gray-900 font-semibold">{edadCalculada} años</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Historia Clínica (HC)</p>
                          <p className="text-sm text-[#003178] font-bold">{relative.numero_hc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onNavigate('/dashboard/appointments')}
                        className="w-full bg-white text-gray-700 border border-gray-200 rounded-lg py-2 text-sm font-semibold hover:bg-gray-100 transition-colors flex justify-center items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                        Ver Citas
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal: Agregar Perfil Dependiente (Wizard de 4 Pasos) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-fade-in-up">

            <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Agregar Perfil Dependiente</h3>
                <p className="text-xs text-gray-500">Crea una ficha clínica para un familiar</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            {/* Stepper del Wizard */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs overflow-x-auto gap-2">
              {[
                { step: 1, label: 'Personales' },
                { step: 2, label: 'Ubicación' },
                { step: 3, label: 'Familiar/Lab' },
                { step: 4, label: 'Contacto' }
              ].map(s => {
                const active = wizardStep === s.step;
                const completed = wizardStep > s.step;
                return (
                  <div key={s.step} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold border text-[10px] ${
                      active ? 'bg-[#003178] border-[#003178] text-white shadow-sm' :
                      completed ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-400'
                    }`}>
                      {completed ? '✓' : s.step}
                    </span>
                    <span className={`font-semibold ${active ? 'text-[#003178] font-bold' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
              {submitError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-red-500">error</span>
                  {submitError}
                </div>
              )}

              {/* Paso 1: Datos Personales */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-[#003178] uppercase tracking-wider border-b pb-1">1. Datos Personales</h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombres *</label>
                    <input
                      required
                      type="text"
                      value={newProfile.nombres}
                      onChange={e => handleChange('nombres', e.target.value)}
                      placeholder="Nombres"
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Apellido Paterno *</label>
                      <input
                        required
                        type="text"
                        value={newProfile.apellidoPaterno}
                        onChange={e => handleChange('apellidoPaterno', e.target.value)}
                        placeholder="Apellido Paterno"
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Apellido Materno *</label>
                      <input
                        required
                        type="text"
                        value={newProfile.apellidoMaterno}
                        onChange={e => handleChange('apellidoMaterno', e.target.value)}
                        placeholder="Apellido Materno"
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Género *</label>
                      <select
                        required
                        value={newProfile.genero}
                        onChange={e => handleChange('genero', e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600 bg-white"
                      >
                        <option value="">Seleccionar género...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha de Nacimiento *</label>
                      <input
                        required
                        type="date"
                        value={newProfile.fechaNacimiento}
                        onChange={e => handleChange('fechaNacimiento', e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600"
                      />
                    </div>
                  </div>

                  {edad !== null && (
                    <div className="flex items-center gap-2 px-1 text-xs">
                      <span className="material-symbols-outlined text-[#003178] text-[16px]">info</span>
                      <p className="text-gray-600 font-medium">
                        Edad: <span className="font-bold text-[#003178]">{edad} años</span> ({esMenor ? 'Menor de edad' : 'Mayor de edad'})
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Documento *</label>
                      <select
                        required
                        value={newProfile.tipoDocumento}
                        onChange={e => handleChange('tipoDocumento', e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600 bg-white"
                      >
                        <option value="DNI">DNI</option>
                        <option value="Carnet de extranjería">Carnet de extranjería</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Número de Documento *</label>
                      <input
                        required
                        type="text"
                        value={newProfile.dni}
                        onChange={e => {
                          if (newProfile.tipoDocumento === 'DNI') {
                            handleLimitInput(e, 8, 'dni');
                          } else {
                            handleChange('dni', e.target.value.trim());
                          }
                        }}
                        placeholder="Documento"
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 2: Ubicación */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-[#003178] uppercase tracking-wider border-b pb-1">2. Ubicación</h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">País *</label>
                    <select
                      required
                      value={newProfile.pais}
                      onChange={e => handleCountryChange(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-700 bg-white"
                    >
                      {countries.map(c => (
                        <option key={c.iso2} value={c.nameES}>
                          {getFlagEmoji(c.iso2)} {c.nameES}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección de Domicilio *</label>
                    <input
                      required
                      type="text"
                      value={newProfile.direccion}
                      onChange={e => handleChange('direccion', e.target.value)}
                      placeholder="Dirección del domicilio"
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                    />
                  </div>

                  {newProfile.pais === 'Perú' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dpto *</label>
                        <select
                          required
                          value={newProfile.departamento}
                          onChange={e => handleDepartmentChange(e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:border-[#003178] outline-none bg-white text-gray-700"
                        >
                          <option value="">Seleccionar...</option>
                          {departamentos.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Provincia *</label>
                        <select
                          required
                          value={newProfile.provincia}
                          onChange={e => handleProvinceChange(e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:border-[#003178] outline-none bg-white text-gray-700"
                          disabled={!newProfile.departamento}
                        >
                          <option value="">Seleccionar...</option>
                          {filteredProvincias.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Distrito *</label>
                        <select
                          required
                          value={newProfile.distrito}
                          onChange={e => handleChange('distrito', e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-xl text-xs focus:border-[#003178] outline-none bg-white text-gray-700"
                          disabled={!newProfile.provincia}
                        >
                          <option value="">Seleccionar...</option>
                          {filteredDistritos.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Paso 3: Información Familiar y Académica/Laboral */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-[#003178] uppercase tracking-wider border-b pb-1">3. Familia y Ocupación</h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vínculo / Parentesco *</label>
                    <select
                      required
                      value={newProfile.parentesco}
                      onChange={e => handleChange('parentesco', e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600 bg-white"
                    >
                      <option value="">Seleccionar vínculo...</option>
                      <option value="Hijo">Hijo / Hija</option>
                      <option value="Madre">Madre</option>
                      <option value="Padre">Padre</option>
                      <option value="Pareja">Pareja</option>
                      <option value="Tutorado">Tutorado / Dependiente</option>
                      <option value="Otro">Otro familiar</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lugar en la Familia *</label>
                      <input
                        required
                        type="text"
                        value={newProfile.lugarFamilia}
                        onChange={e => handleChange('lugarFamilia', e.target.value)}
                        placeholder="Hijo mayor, etc."
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado Civil *</label>
                      <select
                        required
                        value={newProfile.estadoCivil}
                        onChange={e => handleChange('estadoCivil', e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600 bg-white"
                      >
                        <option value="">Seleccionar...</option>
                        {ESTADOS_CIVILES.map(e => (
                          <option key={e.val} value={e.label}>{e.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Grado de Instrucción *</label>
                      <select
                        required
                        value={newProfile.gradoInstruccion}
                        onChange={e => handleChange('gradoInstruccion', e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none text-gray-600 bg-white"
                      >
                        <option value="">Seleccionar...</option>
                        {GRADOS_INSTRUCCION.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ocupación *</label>
                      <input
                        required
                        type="text"
                        value={newProfile.ocupacion}
                        onChange={e => handleChange('ocupacion', e.target.value)}
                        placeholder="Estudiante, Obrero, etc."
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 4: Contacto */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-[#003178] uppercase tracking-wider border-b pb-1">4. Datos de Contacto</h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Celular / Teléfono {!esMenor && '*'}
                    </label>
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
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        placeholder="999888777"
                        className="flex-1 p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                        required={!esMenor}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Correo Electrónico de Contacto {!esMenor && '*'}
                    </label>
                    <input
                      type="email"
                      value={newProfile.correo}
                      onChange={e => handleChange('correo', e.target.value)}
                      placeholder="ejemplo@correo.com"
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none"
                      required={!esMenor}
                    />
                  </div>
                </div>
              )}

              <footer className="pt-4 border-t border-gray-100 flex justify-between bg-white sticky bottom-0">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                  >
                    Atrás
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-5 py-2 bg-[#003178] hover:bg-blue-900 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer"
                  >
                    Siguiente
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#003178] hover:bg-blue-900 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Registrando...' : 'Registrar Perfil'}
                  </button>
                )}
              </footer>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Family;