import { obtenerPrecioAplicable } from '../../utils/pricingHelper';

/**
 * Helper para acortar nombres de especialistas.
 */
const obtenerNombreCorto = (nombreCompleto) => {
  if (!nombreCompleto) return '';
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 1) return nombreCompleto;
  if (partes.length === 2) return `${partes[0]} ${partes[1]}`;
  if (partes.length === 3) return `${partes[0]} ${partes[1]}`;
  if (partes.length === 4) return `${partes[0]} ${partes[2]}`;
  return `${partes[0]} ${partes[partes.length - 2]}`;
};

/**
 * Helper para mapear el nombre del área/especialidad de una especialista.
 */
const getEspecialidadEspecialista = (empId, dbData) => {
  const empAsignaciones = (dbData.asignaciones || []).filter(a => a && a.empleado_id === empId);
  const areaNames = empAsignaciones.map(a => {
    const area = (dbData.areas || []).find(ar => ar && ar.id === a.area_id);
    return area ? area.nombre : null;
  }).filter(Boolean);
  const areasUnicas = [...new Set(areaNames)];
  return areasUnicas.length > 0 ? areasUnicas.join(', ') : 'Psicología General';
};

/**
 * Helper para rankear jerarquía académica para ordenamiento.
 */
const getJerarquia = (nombre) => {
  if (!nombre) return 4;
  if (nombre.startsWith('Dra.') || nombre.startsWith('Dr.')) return 1;
  if (nombre.startsWith('Mg.')) return 2;
  if (nombre.startsWith('Lic.')) return 3;
  return 4;
};

/**
 * Helper: verifica si un servicio tiene precios válidos.
 */
const serviceHasPricing = (s, dbData) => {
  if (Number(s.precio_sesion || 0) > 0) return true;
  if ((dbData.reglasPrecios || []).some(r => r.servicio_id === s.id && (Number(r.precio || 0) > 0 || Number(r.descuento_porcentaje || 0) > 0))) return true;
  if ((dbData.paquetesCatalogo || []).some(p => p.servicio_id === s.id && Number(p.precio_total || 0) > 0)) return true;
  return false;
};

/**
 * Paso de selección de servicio y especialista.
 * Renderiza un panel dividido: servicios a la izquierda, especialistas a la derecha.
 */
const StepServiceSpecialist = ({
  dbData,
  modalidad,
  localSeleccionado,
  modoBusqueda,
  setModoBusqueda,
  buscarServicio,
  setBuscarServicio,
  servicioSeleccionado,
  setServicioSeleccionado,
  psicologaSeleccionada,
  setPsicologaSeleccionada,
  tipoSesion,
  setTipoSesion,
  paqueteSeleccionado,
  setPaqueteSeleccionado,
  servicioExpandidoId,
  setServicioExpandidoId,
  serviciosBloqueados,
  activePatientPackages,
  especialistasElegibles,
  especialistasConFecha,
  onServiceHeaderClick,
  onEspecialistaChange,
  onModoBusquedaChange,
  onServiceSelect,
  onPackageSelect
}) => {
  const serviciosFiltrados = dbData.servicios.filter(s => {
    if (!s) return false;
    if (s.es_tramite) return false;
    if (!serviceHasPricing(s, dbData)) return false;
    if (buscarServicio.trim() !== '') {
      const query = buscarServicio.toLowerCase();
      if (!(s.nombre_servicio || '').toLowerCase().includes(query)) return false;
    }
    if (!localSeleccionado) return false;
    const isAssociated = s.local_id === localSeleccionado.id || (Array.isArray(s.locales_ids) && s.locales_ids.includes(localSeleccionado.id));
    if (!isAssociated) return false;

    if (modoBusqueda === 'servicio') {
      const hasSpecialist = (especialistasElegibles || []).some(emp =>
        emp && (dbData.psicologoServicio || []).some(ps => ps && ps.psicologo_id === emp.id && ps.servicio_id === s.id)
      );
      if (!hasSpecialist) return false;
    } else {
      if (!psicologaSeleccionada) return false;
      const offersService = (dbData.psicologoServicio || []).some(ps =>
        ps && ps.psicologo_id === psicologaSeleccionada.id && ps.servicio_id === s.id
      );
      if (!offersService) return false;
    }
    return true;
  }).sort((a, b) => (a.nombre_servicio || '').localeCompare(b.nombre_servicio || ''));

  const handleModoBusquedaChange = (nuevoModo) => {
    onModoBusquedaChange(nuevoModo);
  };

  return (
    <div className="space-y-3">
      {/* Switch/Toggle para modo de búsqueda */}
      <div className="flex justify-center w-full max-w-md mx-auto">
        <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 shadow-inner border border-slate-200/50 w-full">
          <button
            type="button"
            onClick={() => handleModoBusquedaChange('servicio')}
            className={`flex-1 px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              modoBusqueda === 'servicio'
                ? 'bg-[#003178] text-white shadow-md'
                : 'bg-transparent text-slate-600 hover:bg-slate-200/55 hover:text-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5 justify-center">
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              Buscar por Servicio
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleModoBusquedaChange('especialista')}
            className={`flex-1 px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              modoBusqueda === 'especialista'
                ? 'bg-[#003178] text-white shadow-md'
                : 'bg-transparent text-slate-600 hover:bg-slate-200/55 hover:text-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5 justify-center">
              <span className="material-symbols-outlined text-[16px]">person</span>
              Buscar por Especialista
            </span>
          </button>
        </div>
      </div>

      <div className={`flex gap-3 items-stretch w-full text-left max-h-[60vh] min-h-[260px] overflow-hidden ${
        modoBusqueda === 'especialista'
          ? 'flex-col-reverse md:flex-row-reverse'
          : 'flex-col md:flex-row'
      }`}>
        {/* Panel Izquierdo: Servicios */}
        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm space-y-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-sans">
              {modoBusqueda === 'servicio' ? '1. Elige un Servicio' : '2. Servicios Disponibles'}
            </h3>
            {modoBusqueda === 'servicio' && (
              <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-100">
                {serviciosFiltrados.length} servicios
              </span>
            )}
          </div>

          <div className="relative shrink-0">
            <input
              type="text"
              placeholder="Filtrar servicios..."
              value={buscarServicio}
              onChange={(e) => setBuscarServicio(e.target.value)}
              className="w-full p-2 pl-9 border border-slate-200 bg-white rounded-xl text-xs focus:border-[#003178] outline-none text-gray-700 font-medium shadow-sm"
            />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1 h-full">
            {modoBusqueda === 'especialista' && !psicologaSeleccionada ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center h-full">
                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 animate-pulse">face</span>
                <p className="text-xs font-semibold max-w-[200px] leading-relaxed">
                  Selecciona una especialista a la derecha para ver los servicios que ofrece.
                </p>
              </div>
            ) : serviciosFiltrados.length === 0 ? (
              <p className="text-xs text-gray-500 bg-white border border-gray-150 rounded-xl p-4 text-center shadow-sm">
                No hay servicios disponibles para los filtros aplicados.
              </p>
            ) : (
              serviciosFiltrados.map(s => {
                const isExpanded = servicioExpandidoId === s.id;
                const isSelected = servicioSeleccionado?.id === s.id;

                const specialistsForService = especialistasElegibles.filter(emp => {
                  if (!emp) return false;
                  const assigned = (dbData.psicologoServicio || []).some(ps =>
                    ps && ps.psicologo_id === emp.id && ps.servicio_id === s.id
                  );
                  if (!assigned) return false;
                  const hasSchedule = (dbData.horarios || []).some(h =>
                    h && h.empleado_id === emp.id &&
                    h.modalidad === modalidad &&
                    h.disponible &&
                    h.tipo !== 'salida' && h.tipo !== 'otro' &&
                    h.local_id === localSeleccionado?.id
                  );
                  return hasSchedule;
                });
                const uniqueSpecialist = specialistsForService.length === 1 ? specialistsForService[0] : null;

                const resolvePrecio = (esp) => obtenerPrecioAplicable({
                  servicio: s,
                  paqueteCatalogo: null,
                  especialista: esp,
                  reglasPrecios: dbData.reglasPrecios,
                  localId: localSeleccionado?.id || null,
                  modalidad: modalidad,
                  asignaciones: dbData.asignaciones,
                  cargos: dbData.cargos
                });

                const precioInfo = psicologaSeleccionada
                  ? resolvePrecio(psicologaSeleccionada)
                  : uniqueSpecialist
                    ? resolvePrecio(uniqueSpecialist)
                    : resolvePrecio(null);

                const precioBaseServicio = Number(s.precio_sesion || 0);
                const tieneReglaPrecio = (dbData.reglasPrecios || []).some(r =>
                  r.servicio_id === s.id && (Number(r.precio || 0) > 0 || Number(r.descuento_porcentaje || 0) > 0)
                );
                const tienePrecioIndividual = precioBaseServicio > 0 || tieneReglaPrecio;
                const precioEsAconsultar = tienePrecioIndividual && !psicologaSeleccionada && !uniqueSpecialist && specialistsForService.length > 1 && tieneReglaPrecio;
                const estaBloqueado = serviciosBloqueados.has(s.nombre_servicio);

                // Verificar si el paciente tiene paquetes adquiridos para este servicio
                const sPaquetesAdquiridosInit = (activePatientPackages || []).filter(p => p.servicio_id === s.id);
                const soloMostrarAdquiridos = sPaquetesAdquiridosInit.length > 0;

                return (
                  <div
                    key={s.id}
                    className={`border rounded-xl transition-all overflow-hidden ${
                      isSelected
                        ? 'border-[#003178] bg-blue-50/10 shadow-sm'
                        : 'border-slate-200/60 bg-white hover:border-slate-355'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onServiceHeaderClick(s)}
                      className="w-full py-2 px-3 flex justify-between items-center text-left font-sans cursor-pointer focus:outline-none"
                    >
                      <div className="flex-1 pr-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-[#003178]' : 'text-slate-800'}`}>
                            {s.nombre_servicio}
                          </p>
                          {/* Badge de promoción: solo visible cuando NO está expandido Y NO tiene paquete adquirido */}
                          {s.promocion_activa && !isExpanded && !soloMostrarAdquiridos && (() => {
                            const today = new Date().toISOString().split('T')[0];
                            const inRange = (!s.promo_fecha_inicio || today >= s.promo_fecha_inicio) && (!s.promo_fecha_fin || today <= s.promo_fecha_fin);
                            const titulo = s.promocion_titulo || (s.promo_descuento_porcentaje ? `${s.promo_descuento_porcentaje}% OFF` : null);
                            if (!inRange || !titulo) return null;
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">
                                {titulo}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-[9px] text-gray-400 font-semibold mt-0.5">
                          Duración: {s.duracion_minutos || s.duracion || 60} min
                        </p>
                      </div>
                      <div className="flex items-center shrink-0 gap-0.5">
                        {estaBloqueado && (
                          <span className="material-symbols-outlined text-amber-500 text-[16px]">lock</span>
                        )}
                        <span className={`material-symbols-outlined text-gray-400 text-[18px] transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#003178]' : ''}`}>
                          expand_more
                        </span>
                      </div>
                    </button>

                    {isExpanded && (() => {
                      const sPaquetes = (dbData.paquetesCatalogo || []).filter(p => p.servicio_id === s.id).sort((a, b) => {
                        const numA = parseInt((a.nombre_paquete || '').match(/\d+/)?.[0], 10) || 0;
                        const numB = parseInt((b.nombre_paquete || '').match(/\d+/)?.[0], 10) || 0;
                        return numA - numB;
                      });
                      const sPaquetesAdquiridos = (activePatientPackages || []).filter(p => p.servicio_id === s.id);

                      // Usar la variable ya calculada antes del header
                      const tieneOpciones = soloMostrarAdquiridos || tienePrecioIndividual || (sPaquetes.length > 0);

                      return (
                        <div className="px-2 pb-2 pt-0.5 border-t border-slate-100 bg-slate-50/50 space-y-1 animate-in slide-in-from-top-1 duration-100">
                          {estaBloqueado ? (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                              <p className="text-[10px] font-bold text-amber-800">
                                Ya cuentas con una sesión pendiente para este servicio. Para agendar la siguiente sesión, debes concluir tu cita anterior.
                              </p>
                            </div>
                          ) : (
                          <>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                            {soloMostrarAdquiridos ? 'Tu Paquete Disponible:' : 'Forma de Reserva:'}
                          </p>
                          <div className="grid grid-cols-1 gap-1">
                            {!tieneOpciones ? (
                              <p className="text-[10px] text-gray-500 text-center py-2.5 bg-white rounded-lg border border-dashed border-gray-200 px-2 font-semibold">
                                No hay tarifas o paquetes configurados actualmente para este servicio con la especialista seleccionada.
                              </p>
                            ) : (
                              <>
                                {/* Sesión Individual: SOLO se muestra si NO tiene paquetes adquiridos */}
                                {!soloMostrarAdquiridos && tienePrecioIndividual && (
                                  <button
                                    type="button"
                                    onClick={() => onServiceSelect('normal', null)}
                                    className={`p-2 rounded-xl border-2 text-left flex justify-between items-center transition-all duration-200 cursor-pointer ${
                                      tipoSesion === 'normal'
                                        ? 'border-[#003178] bg-blue-50/30'
                                        : 'border-slate-200/60 bg-white hover:bg-slate-55'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-bold text-slate-800">Sesión Individual</p>
                                        {/* Badge de promoción en sesión individual */}
                                        {s.promocion_activa && precioInfo.tienePromocion && (() => {
                                          const today = new Date().toISOString().split('T')[0];
                                          const inRange = (!s.promo_fecha_inicio || today >= s.promo_fecha_inicio) && (!s.promo_fecha_fin || today <= s.promo_fecha_fin);
                                          const titulo = s.promocion_titulo || (s.promo_descuento_porcentaje ? `${s.promo_descuento_porcentaje}% OFF` : null);
                                          if (!inRange || !titulo) return null;
                                          return (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[7px] font-bold uppercase tracking-wider whitespace-nowrap">
                                              {titulo}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <p className="text-[9px] text-gray-400 mt-0.5">Paga solo por la sesión programada</p>
                                    </div>
                                    <div className="text-right">
                                      {precioEsAconsultar ? (
                                        <span className="text-[11px] font-black text-[#003178] font-sans">A consultar</span>
                                      ) : (
                                        <>
                                          {precioInfo.tienePromocion && (
                                            <span className="text-[9px] text-gray-400 line-through mr-1">
                                              S/ {precioInfo.precioAntesPromocion}
                                            </span>
                                          )}
                                          <span className="text-[11px] font-black text-[#003178] font-sans">
                                            S/ {precioInfo.precioFinal}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </button>
                                )}

                                {sPaquetesAdquiridos.length > 0 && sPaquetesAdquiridos.map(p => {
                                  const isPackSelected = tipoSesion === 'paquete' && paqueteSeleccionado?.type === 'adquirido' && paqueteSeleccionado?.id === p.id;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => onPackageSelect({ ...p, type: 'adquirido' })}
                                      className={`p-2 rounded-xl border-2 text-left flex justify-between items-center transition-all duration-200 cursor-pointer ${
                                        isPackSelected
                                          ? 'border-[#003178] bg-blue-50/30'
                                          : 'border-slate-200/60 bg-white hover:bg-slate-55'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          <p className="text-[11px] font-bold text-slate-800">{p.nombre_paquete_snapshot || 'Paquete Adquirido'}</p>
                                        </div>
                                        <p className="text-[9px] text-gray-400 mt-0.5">{p.sesiones_netas} sesiones disponibles</p>
                                      </div>
                                      <span className="text-[11px] font-black text-[#003178] font-sans">
                                        Usar
                                      </span>
                                    </button>
                                  );
                                })}

                                {/* Paquetes del catálogo: SOLO se muestran si NO tiene paquetes adquiridos */}
                                {!soloMostrarAdquiridos && sPaquetes.length > 0 && sPaquetes.map(p => {
                                  const isPackSelected = tipoSesion === 'paquete' && paqueteSeleccionado?.type === 'catalogo' && paqueteSeleccionado?.id === p.id;
                                  const packPrecioInfo = obtenerPrecioAplicable({
                                    servicio: s,
                                    paqueteCatalogo: p,
                                    especialista: psicologaSeleccionada || uniqueSpecialist || null,
                                    reglasPrecios: dbData.reglasPrecios,
                                    localId: localSeleccionado?.id || null,
                                    modalidad: modalidad,
                                    asignaciones: dbData.asignaciones,
                                    cargos: dbData.cargos
                                  });

                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => onPackageSelect({ ...p, type: 'catalogo' })}
                                      className={`p-2 rounded-xl border-2 text-left flex justify-between items-center transition-all duration-200 cursor-pointer ${
                                        isPackSelected
                                          ? 'border-[#003178] bg-blue-50/30'
                                          : 'border-slate-200/60 bg-white hover:bg-slate-55'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-[11px] font-bold text-slate-800">{p.nombre_paquete}</p>
                                          {/* Badge de promoción en paquete */}
                                          {packPrecioInfo.tienePromocion && (() => {
                                            const packTitulo = p.promocion_titulo || (p.promo_descuento_porcentaje ? `${p.promo_descuento_porcentaje}% OFF` : null);
                                            if (!packTitulo) return null;
                                            return (
                                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[7px] font-bold uppercase tracking-wider whitespace-nowrap">
                                                {packTitulo}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                        <p className="text-[9px] text-gray-400 mt-0.5">{p.cantidad_sesiones ?? p.cant_sesiones} sesiones</p>
                                      </div>
                                      <div className="text-right">
                                        {packPrecioInfo.tienePromocion && (
                                          <span className="text-[9px] text-gray-400 line-through mr-1">
                                            S/ {packPrecioInfo.precioAntesPromocion}
                                          </span>
                                        )}
                                        <span className="text-[11px] font-black text-[#003178] font-sans">
                                          S/ {packPrecioInfo.precioFinal}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel Derecho: Especialistas */}
        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm space-y-3 flex flex-col h-full min-h-0 overflow-hidden">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-sans">
              {modoBusqueda === 'servicio' ? '2. Especialistas Compatibles' : '1. Elige una Especialista'}
            </h3>
            {modoBusqueda === 'servicio' && servicioSeleccionado && (
              <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-100">
                {especialistasConFecha.length} disponibles
              </span>
            )}
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1 h-full">
            {modoBusqueda === 'servicio' && !servicioSeleccionado ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center h-full">
                <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 animate-pulse">psychology</span>
                <p className="text-xs font-semibold max-w-[200px] leading-relaxed">
                  Selecciona un servicio a la izquierda para ver las especialistas compatibles.
                </p>
              </div>
            ) : especialistasConFecha.length === 0 ? (
              <p className="text-xs text-gray-500 bg-white border border-gray-150 rounded-xl p-4 text-center shadow-sm">
                No hay especialistas disponibles con horarios libres en la modalidad seleccionada.
              </p>
            ) : (
              especialistasConFecha.map(p => {
                const isSelected = psicologaSeleccionada?.id === p.id;
                const specialty = getEspecialidadEspecialista(p.id, dbData);
                const nextDateStr = p.fechaProx
                  ? new Date(p.fechaProx + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
                  : null;

                return (
                  <button
                      key={p.id}
                      type="button"
                      onClick={() => onEspecialistaChange(p)}
                      className={`w-full p-2.5 border rounded-xl text-left flex justify-between items-start transition-all cursor-pointer focus:outline-none ${
                        isSelected
                          ? 'border-[#003178] bg-white ring-2 ring-blue-50 shadow-sm'
                          : 'border-slate-200/60 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <h5 className={`font-bold text-xs font-sans leading-tight ${isSelected ? 'text-[#003178]' : 'text-slate-800'}`}>
                          {p.nombres_apellidos}
                        </h5>
                        <p className="text-[10px] text-slate-500 font-semibold font-sans">
                          {specialty}
                        </p>
                        {nextDateStr && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[12px] text-[#003178]">calendar_today</span>
                            <span className="text-[9px] font-bold text-[#003178] bg-blue-50/60 border border-blue-100 rounded px-1.5 py-0.5 font-sans whitespace-nowrap">
                              Prox: {nextDateStr}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-green-50 text-green-700 border border-green-200 uppercase tracking-wide">
                        Disponible
                      </span>
                    </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { obtenerNombreCorto };
export default StepServiceSpecialist;
