import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
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

const toTitleCase = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s\-])\p{L}/gu, char => char.toUpperCase());
};

const getTodayDate = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
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
  id
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
      const estimatedWidth = Math.max(rect.width, Math.min(360, windowWidth * 0.9));
      
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
              minWidth: `${coords.width}px`,
              width: 'max-content',
              maxWidth: 'min(360px, 90vw)'
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
                  className="w-full bg-transparent outline-none text-sm text-gray-770 py-1"
                  autoFocus
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-650 px-1">
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

const getFlagEmoji = (iso2) => {
  if (!iso2) return '';
  const codePoints = iso2
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const Family = () => {
  const { loading, perfilesDependientes, refetch } = usePacienteActual();
  const [memberSearch, setMemberSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [editMemberData, setEditMemberData] = useState(null);

  const handleCloseDetailModal = () => {
    setIsEditingMember(false);
    setSelectedMember(null);
  };

  const handleStartEditMember = (member) => {
    setEditMemberData({
      id_paciente: member.id_paciente,
      nombres: member.nombres || '',
      apellido_paterno: member.apellido_paterno || '',
      apellido_materno: member.apellido_materno || '',
      fecha_nacimiento: member.fecha_nacimiento || '',
      genero: member.genero || '',
      parentesco: member.parentesco || '',
      lugar_familia: member.lugar_familia || '',
      estado_civil: member.estado_civil || '',
      grado_instruccion: member.grado_instruccion || '',
      ocupacion: member.ocupacion || '',
      pais: member.pais || 'Perú',
      departamento: member.departamento || '',
      provincia: member.provincia || '',
      distrito: member.distrito || '',
      direccion: member.direccion || '',
      telefono: member.telefono || '',
      correo: member.correo || ''
    });
    setIsEditingMember(true);
  };

  const handleEditFieldChange = (field, value) => {
    setEditMemberData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditCountryChange = (val) => {
    setEditMemberData(prev => ({
      ...prev,
      pais: val,
      departamento: '',
      provincia: '',
      distrito: ''
    }));
  };

  const handleEditDepartmentChange = (deptName) => {
    setEditMemberData(prev => ({
      ...prev,
      departamento: deptName,
      provincia: '',
      distrito: ''
    }));
  };

  const handleEditProvinceChange = (provName) => {
    setEditMemberData(prev => ({
      ...prev,
      provincia: provName,
      distrito: ''
    }));
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    try {
      if (!editMemberData.nombres?.trim() || !editMemberData.apellido_paterno?.trim() || !editMemberData.apellido_materno?.trim()) {
        throw new Error('Nombres y apellidos del familiar son campos obligatorios.');
      }
      if (!editMemberData.genero || !editMemberData.parentesco) {
        throw new Error('Género y Parentesco son campos obligatorios.');
      }
      if (editMemberData.fecha_nacimiento && editMemberData.fecha_nacimiento > getTodayDate()) {
        throw new Error('La fecha de nacimiento no puede ser una fecha futura.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const cleanedNombres = toTitleCase(editMemberData.nombres);
      const cleanedPaterno = toTitleCase(editMemberData.apellido_paterno);
      const cleanedMaterno = toTitleCase(editMemberData.apellido_materno);

      const { data, error } = await supabase
        .from('pacientes')
        .update({
          nombres: cleanedNombres,
          apellido_paterno: cleanedPaterno,
          apellido_materno: cleanedMaterno,
          fecha_nacimiento: editMemberData.fecha_nacimiento || null,
          genero: editMemberData.genero,
          parentesco: editMemberData.parentesco,
          lugar_familia: editMemberData.lugar_familia || null,
          estado_civil: editMemberData.estado_civil || null,
          grado_instruccion: editMemberData.grado_instruccion || null,
          ocupacion: editMemberData.ocupacion || null,
          pais: editMemberData.pais || 'Perú',
          departamento: editMemberData.pais === 'Perú' ? (editMemberData.departamento || null) : null,
          provincia: editMemberData.pais === 'Perú' ? (editMemberData.provincia || null) : null,
          distrito: editMemberData.pais === 'Perú' ? (editMemberData.distrito || null) : null,
          direccion: editMemberData.direccion || null,
          telefono: editMemberData.telefono || null,
          correo: editMemberData.correo || null
        })
        .eq('id_paciente', editMemberData.id_paciente)
        .eq('id_apoderado', user.id)
        .select()
        .single();

      if (error) throw error;

      alert('Miembro familiar actualizado exitosamente.');
      setIsEditingMember(false);
      refetch();
      setSelectedMember(data);
    } catch (err) {
      alert(err.message || 'Error al guardar los cambios del familiar.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const navigate = useNavigate();

  useEffect(() => {
    if (isAddModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAddModalOpen]);

  // Paso del wizard en el modal
  const [wizardStep, setWizardStep] = useState(1);

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

  const handleCountryChange = (val) => {
    setNewProfile(prev => ({
      ...prev,
      pais: val,
      departamento: '',
      provincia: '',
      distrito: '',
      tipoDocumento: val === 'Perú' ? 'DNI' : 'Carnet de extranjería'
    }));
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

  const handleVerCitas = (relative) => {
    const fullName = `${relative.nombres} ${relative.apellido_paterno} ${relative.apellido_materno || ''}`.trim();
    navigate('/dashboard/appointments', {
      state: {
        memberId: relative.id_paciente,
        memberName: fullName
      }
    });
  };


  const edad = newProfile.fechaNacimiento ? calcularEdad(newProfile.fechaNacimiento) : null;
  const esMenor = edad !== null && edad < 18;

  const validateStep = (stepNum) => {
    if (stepNum === 1) {
      if (!newProfile.nombres || !newProfile.apellidoPaterno || !newProfile.apellidoMaterno || !newProfile.genero || !newProfile.fechaNacimiento || !newProfile.dni) {
        return 'Completa todos los campos obligatorios de datos personales (*).';
      }
      if (newProfile.fechaNacimiento && newProfile.fechaNacimiento > getTodayDate()) {
        return 'La fecha de nacimiento no puede ser una fecha futura.';
      }
      if (newProfile.tipoDocumento === 'DNI' && newProfile.dni.length !== 8) {
        return 'El DNI debe tener exactamente 8 dígitos.';
      }
      if (newProfile.tipoDocumento !== 'DNI' && (newProfile.dni.length < 8 || newProfile.dni.length > 12)) {
        return 'El Carnet de extranjería debe tener entre 8 y 12 dígitos.';
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
    for (let i = 1; i <= 3; i++) {
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

      // 4. Registrar en la tabla pacientes
      const res = await registrarPaciente({
        numero_hc: numeroHC ?? null,
        dni: newProfile.dni ?? null,
        nombres: toTitleCase(newProfile.nombres) ?? null,
        apellido_paterno: toTitleCase(newProfile.apellidoPaterno) ?? null,
        apellido_materno: toTitleCase(newProfile.apellidoMaterno) ?? null,
        fecha_nacimiento: newProfile.fechaNacimiento ?? null,
        genero: newProfile.genero ?? null,
        direccion: toTitleCase(newProfile.direccion) ?? null,
        parentesco: toTitleCase(newProfile.parentesco) ?? null,
        estado_cuenta: 'STANDBY',
        id_perfil_propio: null,
        id_apoderado: user.id ?? null,
        pais: toTitleCase(newProfile.pais) ?? null,
        departamento: newProfile.pais === 'Perú' ? toTitleCase(newProfile.departamento) ?? null : null,
        provincia: newProfile.pais === 'Perú' ? toTitleCase(newProfile.provincia) ?? null : null,
        distrito: newProfile.pais === 'Perú' ? toTitleCase(newProfile.distrito) ?? null : null,
        lugar_familia: toTitleCase(newProfile.lugarFamilia) ?? null,
        estado_civil: toTitleCase(newProfile.estadoCivil) ?? null,
        grado_instruccion: toTitleCase(newProfile.gradoInstruccion) ?? null,
        ocupacion: toTitleCase(newProfile.ocupacion) ?? null,
        telefono: null,
        correo: null
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

  const searchTerm = memberSearch.trim().toLowerCase();
  const filteredRelatives = (perfilesDependientes || []).filter((member) => {
    const fullName = `${member.nombres ?? ''} ${member.apellido_paterno ?? ''} ${member.apellido_materno ?? ''}`.toLowerCase();
    const dni = String(member.dni ?? '').toLowerCase();
    return (
      fullName.includes(searchTerm) ||
      dni.includes(searchTerm)
    );
  });

  // Filtrado de Ubigeo
  const deptObj = departamentos.find(d => d.name === newProfile.departamento);
  const deptId = deptObj ? deptObj.id : '';
  const filteredProvincias = deptId ? provincias.filter(p => p.department_id === deptId) : [];

  const provObj = provincias.find(p => p.name === newProfile.provincia && p.department_id === deptId);
  const provId = provObj ? provObj.id : '';
  const filteredDistritos = provId ? distritos.filter(d => d.province_id === provId && d.department_id === deptId) : [];

  const countryOptions = countries.map(c => ({
    value: c.nameES,
    label: c.nameES,
    flag: <FlagImage iso2={c.iso2} />,
    searchKey: c.nameES
  }));

  return (
    <DashboardLayout currentPath="/dashboard/family font-['Manrope']">
      {/* Encabezado de página */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Miembros de la Cuenta</h2>
          <p className="text-gray-500 text-lg max-w-2xl">
            Gestiona los miembros clínicos de tus hijos, familiares o dependientes para agendar sus citas.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-[#003178] text-white rounded-lg px-5 py-2.5 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-900 transition-all shadow-sm active:scale-[0.98] shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Agregar Miembro
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-[#003178] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Cargando miembros...</span>
        </div>
      ) : (
        <>
          {/* Campo de búsqueda */}
          {perfilesDependientes && perfilesDependientes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8 shadow-sm max-w-xl flex flex-col sm:flex-row sm:items-center gap-4">
              <label htmlFor="member-search-input" className="font-bold text-xs text-gray-500 uppercase flex items-center gap-1.5 tracking-wider shrink-0 select-none">
                <span className="material-symbols-outlined text-gray-400 text-[18px]">search</span>
                Buscar miembro
              </label>
              <div className="relative flex-1">
                <input
                  id="member-search-input"
                  type="text"
                  placeholder="Buscar por DNI o nombre..."
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-750 focus:border-[#003178] outline-none transition-colors w-full h-[46px]"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
                {memberSearch && (
                  <button
                    type="button"
                    onClick={() => setMemberSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 transition-colors p-0.5 rounded-full hover:bg-gray-150 flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cuadrícula de miembros */}
          {perfilesDependientes && perfilesDependientes.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
              <span className="material-symbols-outlined text-gray-300 text-6xl mb-4">groups</span>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Sin miembros dependientes</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                Aún no has registrado miembros para tus familiares. Puedes agregar hijos o personas a tu cargo para agendar sus citas.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 bg-[#003178] hover:bg-blue-900 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Crear Primer Miembro
              </button>
            </div>
          ) : filteredRelatives.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
              <span className="material-symbols-outlined text-gray-300 text-6xl mb-4">search_off</span>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Sin resultados</h3>
              <p className="text-gray-500 text-sm">
                No se encontraron miembros con ese DNI o nombre.
              </p>
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
                      <div className="flex gap-2 w-full mt-auto">
                        <button
                          onClick={() => setSelectedMember(relative)}
                          className="flex-1 bg-white text-gray-700 border border-gray-200 rounded-lg py-2 text-xs font-semibold hover:bg-gray-100 transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          Ver Datos
                        </button>
                        <button
                          onClick={() => handleVerCitas(relative)}
                          className="flex-1 bg-[#003178] hover:bg-blue-900 text-white rounded-lg py-2 text-xs font-semibold transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                          Ver Citas
                        </button>
                      </div>
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
        <div 
          onClick={() => setIsAddModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-fade-in-up"
          >

            <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Agregar Miembro Dependiente</h3>
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
                { step: 3, label: 'Familiar/Lab' }
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
                      onChange={e => handleChange('nombres', e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ''))}
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
                        onChange={e => handleChange('apellidoPaterno', e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ''))}
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
                        onChange={e => handleChange('apellidoMaterno', e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ''))}
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
                        max={getTodayDate()}
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
                          const limit = newProfile.tipoDocumento === 'DNI' ? 8 : 12;
                          const val = e.target.value.replace(/\D/g, '');
                          handleChange('dni', val.slice(0, limit));
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
                    <ComboBox
                      required
                      searchable
                      options={countryOptions}
                      value={newProfile.pais}
                      onChange={handleCountryChange}
                      placeholder="Seleccione país"
                    />
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
                      <option value="Tutorado">Tutorado</option>
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

                {wizardStep < 3 ? (
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
                    {isSubmitting ? 'Registrando...' : 'Registrar Miembro'}
                  </button>
                )}
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ver Datos Clínicos del Miembro */}
      {selectedMember && (
        <div 
          onClick={handleCloseDetailModal}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[2rem] border border-gray-200 shadow-xl overflow-hidden max-w-2xl w-full p-8 md:p-10 animate-fade-in-up max-h-[90vh] flex flex-col"
          >
            <header className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6 shrink-0">
              <div>
                <h3 className="text-2xl font-bold text-[#003178] uppercase tracking-tighter">
                  {isEditingMember ? 'Editar Datos del Miembro' : 'Ficha Clínica del Miembro'}
                </h3>
                <p className="text-gray-550 font-medium text-xs mt-0.5">
                  {isEditingMember ? 'Modifica los datos personales y de contacto' : 'Datos registrados para la atención médica'}
                </p>
              </div>
              <button 
                onClick={handleCloseDetailModal} 
                className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-full hover:bg-gray-100"
              >
                <span className="material-symbols-outlined font-bold notranslate" translate="no">close</span>
              </button>
            </header>

            {isEditingMember ? (
              <form onSubmit={handleSaveMember} className="overflow-y-auto flex-1 pr-2 space-y-6">
                {/* Header profile info edit inputs */}
                <div className="space-y-4 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombres *</label>
                      <input
                        required
                        type="text"
                        value={editMemberData.nombres}
                        onChange={e => handleEditFieldChange('nombres', e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ''))}
                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-750"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ap. Paterno *</label>
                      <input
                        required
                        type="text"
                        value={editMemberData.apellido_paterno}
                        onChange={e => handleEditFieldChange('apellido_paterno', e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ''))}
                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-750"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ap. Materno *</label>
                      <input
                        required
                        type="text"
                        value={editMemberData.apellido_materno}
                        onChange={e => handleEditFieldChange('apellido_materno', e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ''))}
                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-750"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Parentesco *</label>
                    <select
                      required
                      value={editMemberData.parentesco}
                      onChange={e => handleEditFieldChange('parentesco', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                    >
                      <option value="">Seleccione parentesco...</option>
                      <option value="Hijo">Hijo / Hija</option>
                      <option value="Madre">Madre</option>
                      <option value="Padre">Padre</option>
                      <option value="Pareja">Pareja</option>
                      <option value="Tutor">Tutor</option>
                      <option value="Tutorado">Tutorado</option>
                      <option value="Abuelo/a">Abuelo/a</option>
                      <option value="Hermano/a">Hermano/a</option>
                      <option value="Otro">Otro familiar</option>
                    </select>
                  </div>
                </div>

                {/* Grid of info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">DNI (No editable)</p>
                    <p className="font-semibold text-gray-500 mt-1.5 p-2.5 bg-gray-100 rounded-xl">{selectedMember.dni}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha de Nacimiento *</label>
                    <input
                      required
                      type="date"
                      value={editMemberData.fecha_nacimiento}
                      onChange={e => handleEditFieldChange('fecha_nacimiento', e.target.value)}
                      max={getTodayDate()}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-755"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Género *</label>
                    <select
                      required
                      value={editMemberData.genero}
                      onChange={e => handleEditFieldChange('genero', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                    >
                      <option value="">Seleccione...</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Estado Civil</label>
                    <select
                      value={editMemberData.estado_civil}
                      onChange={e => handleEditFieldChange('estado_civil', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                    >
                      <option value="">Seleccione...</option>
                      {ESTADOS_CIVILES.map(e => <option key={e.val} value={e.label}>{e.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Lugar en Familia</label>
                    <input
                      type="text"
                      value={editMemberData.lugar_familia}
                      onChange={e => handleEditFieldChange('lugar_familia', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-750"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Grado de Instrucción</label>
                    <select
                      value={editMemberData.grado_instruccion}
                      onChange={e => handleEditFieldChange('grado_instruccion', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                    >
                      <option value="">Seleccione...</option>
                      {GRADOS_INSTRUCCION.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ocupación</label>
                    <input
                      type="text"
                      value={editMemberData.ocupacion}
                      onChange={e => handleEditFieldChange('ocupacion', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-750"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">País de Residencia *</label>
                    <select
                      value={editMemberData.pais}
                      onChange={e => handleEditCountryChange(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-750"
                    >
                      {countries.map(c => (
                        <option key={c.iso2} value={c.nameES}>
                          {c.nameES}
                        </option>
                      ))}
                    </select>
                  </div>

                  {editMemberData.pais === 'Perú' && (
                    <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-450 uppercase mb-1">Departamento *</label>
                        <select
                          required
                          value={editMemberData.departamento}
                          onChange={e => handleEditDepartmentChange(e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                        >
                          <option value="">Seleccionar...</option>
                          {departamentos.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-450 uppercase mb-1">Provincia *</label>
                        <select
                          required
                          value={editMemberData.provincia}
                          onChange={e => handleEditProvinceChange(e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                          disabled={!editMemberData.departamento}
                        >
                          <option value="">Seleccionar...</option>
                          {editMemberData.departamento &&
                            provincias
                              .filter(p => p.department_id === departamentos.find(d => d.name === editMemberData.departamento)?.id)
                              .map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                              ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-450 uppercase mb-1">Distrito *</label>
                        <select
                          required
                          value={editMemberData.distrito}
                          onChange={e => handleEditFieldChange('distrito', e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-700"
                          disabled={!editMemberData.provincia}
                        >
                          <option value="">Seleccionar...</option>
                          {editMemberData.provincia &&
                            distritos
                              .filter(
                                d =>
                                  d.province_id ===
                                    provincias.find(
                                      p =>
                                        p.name === editMemberData.provincia &&
                                        p.department_id === departamentos.find(dept => dept.name === editMemberData.departamento)?.id
                                    )?.id &&
                                  d.department_id === departamentos.find(dept => dept.name === editMemberData.departamento)?.id
                              )
                              .map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                              ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Dirección Completa *</label>
                    <input
                      required
                      type="text"
                      value={editMemberData.direccion}
                      onChange={e => handleEditFieldChange('direccion', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-750"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Celular</label>
                    <input
                      type="text"
                      value={editMemberData.telefono}
                      onChange={e => handleEditFieldChange('telefono', e.target.value.replace(/\D/g, '').slice(0, 15))}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-755"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={editMemberData.correo}
                      onChange={e => handleEditFieldChange('correo', e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#003178] outline-none bg-white text-gray-750"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsEditingMember(false)}
                    className="px-5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-500 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="overflow-y-auto flex-1 pr-2 space-y-6">
                  {/* Header profile info */}
                  <div className="flex items-center gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                    <div className="w-14 h-14 rounded-full bg-blue-100 text-[#003178] flex items-center justify-center text-xl font-bold uppercase shrink-0">
                      {`${selectedMember.nombres?.charAt(0) || ''}${selectedMember.apellido_paterno?.charAt(0) || ''}`}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg leading-tight">
                        {`${selectedMember.nombres} ${selectedMember.apellido_paterno} ${selectedMember.apellido_materno || ''}`.trim()}
                      </h4>
                      <p className="text-xs text-[#003178] font-bold mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full bg-white border border-blue-200">
                        {selectedMember.parentesco || 'Familiar'}
                      </p>
                    </div>
                  </div>

                  {/* Grid of info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Historia Clínica (HC)</p>
                      <p className="font-bold text-[#003178] mt-1">{selectedMember.numero_hc || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Documento de Identidad</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.dni || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Fecha de Nacimiento</p>
                      <p className="font-semibold text-gray-900 mt-1">
                        {selectedMember.fecha_nacimiento 
                          ? new Date(selectedMember.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
                          : 'No registrado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Edad</p>
                      <p className="font-semibold text-gray-900 mt-1">
                        {selectedMember.fecha_nacimiento ? `${calcularEdad(selectedMember.fecha_nacimiento)} años` : 'No registrado'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Género</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.genero || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Estado Civil</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.estado_civil || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Lugar en Familia</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.lugar_familia || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Grado de Instrucción</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.grado_instruccion || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Ocupación</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.ocupacion || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">País de Residencia</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.pais || 'No registrado'}</p>
                    </div>
                    
                    {selectedMember.pais === 'Perú' && (
                      <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Departamento</p>
                          <p className="font-semibold text-gray-900 mt-1">{selectedMember.departamento || 'No registrado'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Provincia</p>
                          <p className="font-semibold text-gray-900 mt-1">{selectedMember.provincia || 'No registrado'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Distrito</p>
                          <p className="font-semibold text-gray-900 mt-1">{selectedMember.distrito || 'No registrado'}</p>
                        </div>
                      </div>
                    )}

                    <div className="col-span-1 md:col-span-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Dirección Completa</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.direccion || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Celular</p>
                      <p className="font-semibold text-gray-900 mt-1">{selectedMember.telefono || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Correo Electrónico</p>
                      <p className="font-semibold text-gray-900 mt-1 truncate">{selectedMember.correo || 'No registrado'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEditMember(selectedMember)}
                    className="px-5 py-2.5 border border-[#003178] text-[#003178] hover:bg-blue-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm notranslate" translate="no">edit</span>
                    Editar Datos
                  </button>
                  <button
                    onClick={handleCloseDetailModal}
                    className="px-6 py-2.5 bg-[#003178] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Family;