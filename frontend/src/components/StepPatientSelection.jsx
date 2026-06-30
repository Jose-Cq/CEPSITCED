import React from 'react';
import SelectableCard from './SelectableCard';

/**
 * Componente de presentación para el Paso 1: Selección de Paciente, Modalidad y Local.
 */
const StepPatientSelection = ({
  paraQuien,
  familiarId,
  modalidad,
  localSeleccionado,
  perfilUsuario,
  perfilesDependientes,
  esClinicoIncompletoYo,
  esClinicoIncompletoFamiliar,
  isPresencialAvailable,
  isVirtualAvailable,
  locales,
  handlePacienteChange,
  handleModalidadChange,
  handleLocalChange,
  navigate
}) => {
  const pacienteValid = paraQuien === 'yo'
    ? !esClinicoIncompletoYo
    : (familiarId !== '' && !esClinicoIncompletoFamiliar);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Sección 1: Paciente */}
      <div className="space-y-2.5 text-left">
        <h4 className="font-bold text-xs text-slate-700 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex items-center gap-1.5 font-sans">
          <span className="material-symbols-outlined text-slate-500 text-base">person</span>
          1. Selecciona el Paciente
        </h4>

        <div className="flex flex-wrap gap-3 w-full">
          <SelectableCard
            icon="account_circle"
            title="Cita para mí"
            description="Reservar usando mi ficha clínica"
            isSelected={paraQuien === 'yo'}
            onClick={() => handlePacienteChange('yo', '')}
          />

          <SelectableCard
            icon="groups"
            title="Cita para otro miembro"
            description="Hijo, pareja o familiar dependiente"
            isSelected={paraQuien === 'familiar'}
            onClick={() => handlePacienteChange('familiar', '')}
          />

          {/* Datos o Selector de Familiar */}
          <div className="w-full sm:flex-1 flex">
            {paraQuien === 'yo' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left animate-in fade-in slide-in-from-top-1 duration-200 w-full h-[88px] flex flex-col justify-center overflow-hidden">
                <p className="font-semibold text-slate-900 text-xs font-sans leading-snug truncate">
                  {perfilUsuario?.nombres} {perfilUsuario?.apellido_paterno} {perfilUsuario?.apellido_materno}
                </p>
                <p className="font-semibold text-slate-600 text-[11px] font-sans mt-0.5">DNI: {perfilUsuario?.dni}</p>
                {esClinicoIncompletoYo && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-red-500 text-[12px]">warning</span>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/profile')}
                      className="text-[10px] text-red-600 underline font-bold cursor-pointer"
                    >
                      Completar ficha
                    </button>
                  </div>
                )}
              </div>
            )}

            {paraQuien === 'familiar' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left animate-in fade-in slide-in-from-top-1 duration-200 w-full h-[88px] flex flex-col justify-center overflow-hidden">
                {(!perfilesDependientes || perfilesDependientes.length === 0) ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-gray-500 font-semibold font-sans">No tienes miembros registrados.</p>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/family')}
                      className="bg-[#003178] hover:bg-blue-900 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-[12px]">person_add</span>
                      Agregar
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      value={familiarId}
                      onChange={e => handlePacienteChange('familiar', e.target.value)}
                      className="w-full p-1.5 border border-gray-200 bg-white rounded-lg text-[11px] focus:border-[#003178] outline-none text-gray-700 font-sans"
                    >
                      <option value="">Seleccionar miembro...</option>
                      {(perfilesDependientes || []).map(dep => {
                        const primerNombre = (dep.nombres || '').trim().split(' ')[0];
                        const primerApellido = (dep.apellido_paterno || '').trim().split(' ')[0];
                        return (
                          <option key={dep.id_paciente} value={dep.id_paciente}>
                            {primerNombre} {primerApellido} - DNI: {dep.dni}
                          </option>
                        );
                      })}
                    </select>
                    {familiarId && esClinicoIncompletoFamiliar && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-red-500 text-[12px]">warning</span>
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard/family')}
                          className="text-[10px] text-red-600 underline font-bold cursor-pointer"
                        >
                          Completar ficha
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sección 2: Modalidad */}
      {pacienteValid && (
        <div className="space-y-2.5 text-left border-t border-slate-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <h4 className="font-bold text-xs text-slate-700 uppercase tracking-widest pb-1.5 flex items-center gap-1.5 font-sans">
            <span className="material-symbols-outlined text-slate-500 text-base">psychology</span>
            2. Selecciona la Modalidad
          </h4>

          {!isPresencialAvailable && !isVirtualAvailable ? (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined">error</span>
              No hay disponibilidad en el sistema en este momento. Inténtelo más tarde.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 w-full">
              {isPresencialAvailable && (
                <SelectableCard
                  icon="storefront"
                  title="Atención Presencial"
                  description="Asiste a nuestros consultorios físicos"
                  isSelected={modalidad === 'Presencial'}
                  onClick={() => handleModalidadChange('Presencial')}
                />
              )}

              {isVirtualAvailable && (
                <SelectableCard
                  icon="videocam"
                  title="Atención Virtual"
                  description="Sesión online mediante videollamada"
                  isSelected={modalidad === 'Virtual'}
                  onClick={() => handleModalidadChange('Virtual')}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Sección 3: Local */}
      {pacienteValid && (modalidad === 'Presencial' || modalidad === 'Virtual') && (
        <div className="space-y-2.5 text-left border-t border-slate-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <h4 className="font-bold text-xs text-slate-700 uppercase tracking-widest pb-1.5 flex items-center gap-1.5 font-sans">
            <span className="material-symbols-outlined text-slate-500 text-base">storefront</span>
            3. Selecciona la Sede
          </h4>
          {(!locales || locales.length === 0) ? (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2 max-w-xl">
              <span className="material-symbols-outlined text-amber-500">warning</span>
              No hay locales disponibles.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 w-full">
              {(locales || []).map(l => {
                const isSelected = localSeleccionado?.id === l.id;
                return (
                  <SelectableCard
                    key={l.id}
                    icon="storefront"
                    title={l.nombre}
                    description={l.direccion || 'Dirección de sede'}
                    isSelected={isSelected}
                    onClick={() => handleLocalChange(l)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StepPatientSelection;
