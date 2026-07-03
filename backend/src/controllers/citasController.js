import { supabase } from '../config/supabase.js';
import { sendSolicitudCambioPsicologoEmail } from '../utils/mailer.js';

// Auxiliar para validar que el paciente pertenece al usuario o es su dependiente
const verificarPertenenciaPaciente = async (pacienteId, userId) => {
  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('id_perfil_propio, id_apoderado')
    .eq('id_paciente', pacienteId)
    .maybeSingle();

  if (error || !paciente) return false;
  return paciente.id_perfil_propio === userId || paciente.id_apoderado === userId;
};

// Auxiliar para validar que la cita pertenece a un paciente del usuario
const verificarPertenenciaCita = async (citaId, userId) => {
  const { data: cita, error } = await supabase
    .from('citas')
    .select('paciente_id')
    .eq('id', citaId)
    .maybeSingle();

  if (error || !cita) return false;
  return verificarPertenenciaPaciente(cita.paciente_id, userId);
};

export const getCitasPaciente = async (req, res) => {
  const { pacienteId } = req.params;
  if (!pacienteId) {
    return res.status(400).json({ success: false, error: 'ID de paciente no proporcionado.' });
  }

  try {
    const tieneAcceso = await verificarPertenenciaPaciente(pacienteId, req.user.id);
    if (!tieneAcceso) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para ver las citas de este paciente.' });
    }

    // Safety check/cleanup of fully consumed packages
    try {
      const { data: activePacks } = await supabase
        .from('paquetes_adquiridos')
        .select('id, sesiones_totales, sesiones_disponibles')
        .eq('paciente_id', pacienteId);

      if (activePacks && activePacks.length > 0) {
        for (const pack of activePacks) {
          if (pack.sesiones_disponibles === 0) {
            // Fetch appointments for this package
            const { data: packCitas } = await supabase
              .from('citas')
              .select('estado_cita')
              .eq('paquete_id', pack.id);

            const nonCancelledCitas = (packCitas || []).filter(c => {
              const est = (c.estado_cita || '').toLowerCase();
              return est !== 'cancelado' && est !== 'cancelada';
            });

            // If all booked sessions are completed/attended/done, delete the package
            const allConsumed = nonCancelledCitas.length === pack.sesiones_totales && 
              nonCancelledCitas.every(c => {
                const est = (c.estado_cita || '').toLowerCase();
                return ['realizada', 'completada', 'atendido', 'ausente'].includes(est);
              });

            if (allConsumed) {
              await supabase.from('paquetes_adquiridos').delete().eq('id', pack.id);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error during safety package cleanup:', e.message);
    }

    // Query cita_pacientes_adicionales to find all cita_ids where the user is an accompanist
    const { data: additionalMatches, error: additionalErr } = await supabase
      .from('cita_pacientes_adicionales')
      .select('cita_id')
      .eq('paciente_id', pacienteId);

    if (additionalErr) throw additionalErr;

    const additionalCitaIds = (additionalMatches || []).map(m => m.cita_id);

    let query = supabase
      .from('citas')
      .select('*, habitaciones(nombre, locales(nombre, direccion))');

    if (additionalCitaIds.length > 0) {
      query = query.or(`paciente_id.eq.${pacienteId},id.in.(${additionalCitaIds.join(',')})`);
    } else {
      query = query.eq('paciente_id', pacienteId);
    }

    const { data, error } = await query.order('fecha_cita', { ascending: false });
    if (error) throw error;

    // Filter out cancelled appointments for companions (non-titulars)
    const filteredData = (data || []).filter(cita => {
      const isTitular = String(cita.paciente_id).trim().toLowerCase() === String(pacienteId).trim().toLowerCase();
      if (isTitular) return true; // Titular sees everything (including cancelled)

      // Accompanist only sees active appointments
      const estado = (cita.estado_cita || '').toLowerCase();
      return estado !== 'cancelado' && estado !== 'cancelada';
    });

    // Tag each appointment with its ownership role
    for (const cita of filteredData) {
      cita.es_titular = String(cita.paciente_id).trim().toLowerCase() === String(pacienteId).trim().toLowerCase();
    }

    // Dynamic session numbering by chronological order per (paciente, servicio)
    if (filteredData.length > 0) {
      // Group citas by servicio
      const byServicio = {};
      for (const cita of filteredData) {
        if (!byServicio[cita.servicio]) byServicio[cita.servicio] = [];
        byServicio[cita.servicio].push(cita);
      }
      // Compute rank for each cita within its servicio
      const sessionMap = {};
      for (const servicio of Object.keys(byServicio)) {
        const validCitas = byServicio[servicio]
          .filter(c => {
            const estado = (c.estado_cita || '').toLowerCase();
            return estado !== 'cancelado' && estado !== 'ausente';
          })
          .sort((a, b) => {
            const dateCmp = String(a.fecha_cita).localeCompare(String(b.fecha_cita));
            if (dateCmp !== 0) return dateCmp;
            return String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || ''));
          });
        validCitas.forEach((cita, idx) => {
          sessionMap[cita.id] = idx + 1;
        });
      }
      for (const cita of filteredData) {
        cita.numero_sesion = sessionMap[cita.id] || null;
      }

      // Look up coupon info for each cita
      const citaIds = filteredData.map(c => c.id);
      const { data: cuponUsos, error: cuponError } = await supabase
        .from('cupones_usos')
        .select('cita_id, cupones!inner(codigo, tipo_descuento, valor_descuento)')
        .in('cita_id', citaIds);

      if (!cuponError && cuponUsos) {
        const cuponMap = {};
        for (const uso of cuponUsos) {
          cuponMap[uso.cita_id] = uso.cupones;
        }
        for (const cita of filteredData) {
          cita.cupon_aplicado = cuponMap[cita.id] || null;
        }
      }
    }

    return res.json({ success: true, data: filteredData });
  } catch (error) {
    console.error('Error en getCitasPaciente:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const postCrearCita = async (req, res) => {
  const citaData = req.body;
  if (!citaData.paciente_id) {
    return res.status(400).json({ success: false, error: 'El ID de paciente es obligatorio.' });
  }

  try {
    const tieneAcceso = await verificarPertenenciaPaciente(citaData.paciente_id, req.user.id);
    if (!tieneAcceso) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para crear citas para este paciente.' });
    }

    // --- VALIDACIÓN DE CRUCE DE HORARIOS PARA EL PACIENTE ---
    const { data: overlappingCitas, error: overlapError } = await supabase
      .from('citas')
      .select('id, hora_inicio, hora_fin')
      .eq('paciente_id', citaData.paciente_id)
      .eq('fecha_cita', citaData.fecha_cita)
      .neq('estado_cita', 'Cancelado')
      .neq('estado_cita', 'Cancelada');

    if (overlapError) throw overlapError;

    if (overlappingCitas && overlappingCitas.length > 0) {
      const toMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const propStart = toMinutes(citaData.hora_inicio);
      const propEnd = toMinutes(citaData.hora_fin);

      const hasOverlap = overlappingCitas.some(c => {
        const cStart = toMinutes(c.hora_inicio);
        const cEnd = toMinutes(c.hora_fin);
        return propStart < cEnd && propEnd > cStart;
      });

      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          error: 'Ya tienes una cita agendada para este mismo día y hora. Por favor, selecciona otro horario.'
        });
      }
    }

    // --- LÓGICA DE CONTROL DE CAMBIO DE PSICÓLOGO CON ORDENACIÓN CRONOLÓGICA REAL ---
    // Consultar todas las citas existentes no canceladas para este paciente y servicio
    const { data: existingCitas, error: historyError } = await supabase
      .from('citas')
      .select('id, psicologo_id, psicologa_nombre, fecha_cita, hora_inicio, estado_cita')
      .eq('paciente_id', citaData.paciente_id)
      .eq('servicio', citaData.servicio)
      .neq('estado_cita', 'Cancelado')
      .neq('estado_cita', 'Cancelada');

    if (historyError) throw historyError;

    // Ordenar de forma descendente (el más reciente primero)
    const sortedCitasDesc = (existingCitas || []).sort((a, b) => {
      const dateCmp = String(b.fecha_cita).localeCompare(String(a.fecha_cita));
      if (dateCmp !== 0) return dateCmp;
      return String(b.hora_inicio || '').localeCompare(String(a.hora_inicio || ''));
    });

    // Identificar al psicólogo actual (el más reciente en el historial)
    const psicologoActualId = sortedCitasDesc.length > 0 ? sortedCitasDesc[0].psicologo_id : null;

    // Determinar si es cambio de especialista
    const isSpecialistChange = psicologoActualId ? (citaData.psicologo_id !== psicologoActualId) : false;

    // Calcular cantidad lineal de cambios en el historial de forma ascendente
    const chronologicalHistory = [...sortedCitasDesc].reverse();
    let cambiosPasados = 0;
    for (let i = 1; i < chronologicalHistory.length; i++) {
      if (chronologicalHistory[i].psicologo_id !== chronologicalHistory[i - 1].psicologo_id) {
        cambiosPasados++;
      }
    }

    const totalEventosCambio = isSpecialistChange ? (cambiosPasados + 1) : cambiosPasados;

    if (isSpecialistChange) {
      if (totalEventosCambio >= 3) {
        return res.status(400).json({
          success: false,
          error: 'Has superado el límite de cambios de especialista para este servicio. Por favor, contáctate con Recepción.'
        });
      }
    }

    // --- Block: one pending/unpaid session per service at a time ---
    const { data: pendingCita, error: pendingError } = await supabase
      .from('citas')
      .select('id')
      .eq('paciente_id', citaData.paciente_id)
      .eq('servicio', citaData.servicio)
      .neq('estado_cita', 'Cancelado')
      .neq('estado_cita', 'Cancelada')
      .neq('estado_pago', 'Rechazado')
      .or('estado_cita.eq.Pendiente,estado_pago.eq.Pendiente')
      .limit(1);

    if (pendingError) throw pendingError;

    if (pendingCita && pendingCita.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya cuentas con una sesión pendiente para este servicio. Para agendar la siguiente sesión, debes concluir tu cita anterior.'
      });
    }

    // Resolve or register the package purchase if catalog package is sent
    let resolvedPaqueteCatalogoId = null;
    let resolvedPaqueteAdquiridoId = citaData.paquete_id || null;

    if (citaData.paquete_catalogo_id && !resolvedPaqueteAdquiridoId) {
      try {
        const { data: catalogPack } = await supabase
          .from('paquetes_catalogo')
          .select('*')
          .eq('id', citaData.paquete_catalogo_id)
          .single();

        if (catalogPack) {
          resolvedPaqueteCatalogoId = catalogPack.id;
          
          const todayStr = new Date().toLocaleDateString('sv-SE');
          const datesOk = (!catalogPack.promo_fecha_inicio || todayStr >= catalogPack.promo_fecha_inicio) && 
                          (!catalogPack.promo_fecha_fin || todayStr <= catalogPack.promo_fecha_fin);
          const isPromoActive = catalogPack.promocion_activa && datesOk;
          
          let price = Number(catalogPack.precio_total);
          if (isPromoActive && catalogPack.promo_descuento_porcentaje) {
            price = price * (1 - Number(catalogPack.promo_descuento_porcentaje) / 100);
          }

          const { data: newPack, error: packErr } = await supabase
            .from('paquetes_adquiridos')
            .insert([{
              paciente_id: citaData.paciente_id,
              servicio_id: catalogPack.servicio_id,
              paquete_catalogo_id: catalogPack.id,
              nombre_paquete_snapshot: catalogPack.nombre_paquete,
              sesiones_totales: catalogPack.cantidad_sesiones,
              sesiones_disponibles: catalogPack.cantidad_sesiones,
              monto_pagado: price,
              metodo_pago: citaData.metodo_pago || 'Pago Online'
            }])
            .select()
            .single();

          if (!packErr && newPack) {
            resolvedPaqueteAdquiridoId = newPack.id;
            citaData.paquete_id = newPack.id;
          }
        }
      } catch (e) {
        console.error('Error al registrar compra de paquete en backend:', e.message);
      }
    } else if (resolvedPaqueteAdquiridoId) {
      try {
        const { data: acquiredPack } = await supabase
          .from('paquetes_adquiridos')
          .select('paquete_catalogo_id')
          .eq('id', resolvedPaqueteAdquiridoId)
          .single();

        if (acquiredPack) {
          resolvedPaqueteCatalogoId = acquiredPack.paquete_catalogo_id;
        }
      } catch (e) {
        console.error('Error al buscar paquete adquirido:', e.message);
      }
    }

    // Count existing active sessions for the package to determine if it is Session #1
    let isFirstSession = true;
    if (citaData.paquete_id) {
      const { count: packCitasCount, error: countErr } = await supabase
        .from('citas')
        .select('id', { count: 'exact', head: true })
        .eq('paquete_id', citaData.paquete_id)
        .neq('estado_cita', 'Cancelado')
        .neq('estado_cita', 'Cancelada');

      if (countErr) throw countErr;
      isFirstSession = (packCitasCount || 0) === 0;
    }

    // Apply strict business rules for states and payment methods
    if (citaData.paquete_id) {
      if (isFirstSession) {
        // Session #1: Created as Pendiente / Pendiente with selected payment method
        citaData.estado_cita = 'Pendiente';
        citaData.estado_pago = 'Pendiente';

        let chosenMethod = citaData.metodo_pago || citaData.tipo_pago;
        if (chosenMethod === 'Pago en clínica' || chosenMethod === 'Pago en Clínica' || chosenMethod === 'Pago en Clinica') {
          chosenMethod = 'Pago en Clinica';
        } else {
          chosenMethod = 'Pago Online';
        }
        citaData.metodo_pago = chosenMethod;
        citaData.tipo_pago = chosenMethod;
      } else {
        // Session #2+: Pre-paid by package balance
        citaData.estado_cita = 'Pendiente';
        citaData.estado_pago = 'Pagado';
        citaData.metodo_pago = null;
        citaData.tipo_pago = 'Saldo de Paquete';
      }
    } else {
      // Standard individual appointment payment normalization
      let chosenMethod = citaData.metodo_pago || citaData.tipo_pago;
      if (chosenMethod === 'Pago en clínica' || chosenMethod === 'Pago en Clínica' || chosenMethod === 'Pago en Clinica') {
        chosenMethod = 'Pago en Clinica';
      } else {
        chosenMethod = 'Pago Online';
      }
      citaData.metodo_pago = null;
      citaData.tipo_pago = chosenMethod;
    }

    // Calcular el número estático de sesión del paciente
    const { count: existingCount, error: sesError } = await supabase
      .from('citas')
      .select('*', { count: 'exact', head: true })
      .eq('paciente_id', citaData.paciente_id)
      .eq('servicio', citaData.servicio)
      .not('estado_cita', 'in', '("Cancelado","Ausente")');

    if (sesError) throw sesError;

    citaData.numero_sesion = (existingCount || 0) + 1;

    const { justificacion_cambio_solicitud, cupon_id, paquete_catalogo_id, ...insertData } = citaData;

    // Default flags to false if not set
    insertData.cupon_aplicado = insertData.cupon_aplicado || false;
    insertData.promocion_aplicada = insertData.promocion_aplicada || false;

    if (cupon_id) {
      insertData.cupon_aplicado = true;
    }

    // Pre-evaluate catalog package promotion for Session #1
    if (citaData.paquete_id && isFirstSession) {
      try {
        const { data: acquiredPack } = await supabase
          .from('paquetes_adquiridos')
          .select('paquete_catalogo_id')
          .eq('id', citaData.paquete_id)
          .single();

        if (acquiredPack) {
          const { data: catalogPack } = await supabase
            .from('paquetes_catalogo')
            .select('*')
            .eq('id', acquiredPack.paquete_catalogo_id)
            .single();

          if (catalogPack) {
            const todayStr = new Date().toLocaleDateString('sv-SE');
            const datesOk = (!catalogPack.promo_fecha_inicio || todayStr >= catalogPack.promo_fecha_inicio) && 
                            (!catalogPack.promo_fecha_fin || todayStr <= catalogPack.promo_fecha_fin);
            if (catalogPack.promocion_activa && datesOk) {
              insertData.promocion_aplicada = true;
            }
          }
        }
      } catch (e) {
        console.error('Error pre-evaluando promoción de paquete:', e.message);
      }
    }

    const { data, error } = await supabase
      .from('citas')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;

    // Register coupon use in cupones_usos table if cupon_id is present
    if (cupon_id) {
      try {
        const { error: usageErr } = await supabase
          .from('cupones_usos')
          .insert([{
            cupon_id,
            paciente_id: citaData.paciente_id,
            cita_id: data.id,
            paquete_adquirido_id: citaData.paquete_id || null
          }]);

        if (usageErr) {
          console.error('Error al registrar uso del cupón en base de datos:', usageErr.message);
        } else {
          // Increment uses count on the coupon
          const { data: coupon, error: getErr } = await supabase
            .from('cupones')
            .select('cantidad_usos_actual')
            .eq('id', cupon_id)
            .single();

          if (!getErr && coupon) {
            await supabase
              .from('cupones')
              .update({ cantidad_usos_actual: (coupon.cantidad_usos_actual || 0) + 1 })
              .eq('id', cupon_id);
          }
        }
      } catch (couponErr) {
        console.error('Error procesando el uso del cupón:', couponErr.message);
      }
    }

    // Decrement credit if this cita uses an acquired package (for both Session #1 and Session #2+)
    if (citaData.paquete_id) {
      const { data: packData, error: packFetchError } = await supabase
        .from('paquetes_adquiridos')
        .select('sesiones_disponibles')
        .eq('id', citaData.paquete_id)
        .single();

      if (!packFetchError && packData) {
        const newCount = Math.max(0, (packData.sesiones_disponibles || 0) - 1);
        const { error: packUpdateError } = await supabase
          .from('paquetes_adquiridos')
          .update({ sesiones_disponibles: newCount })
          .eq('id', citaData.paquete_id);
        if (packUpdateError) {
          console.error('Error al descontar crédito del paquete:', packUpdateError.message);
        } else {
          // If this is Session #2+ (meaning it was not the first session), insert usage row into cupones_usos
          if (!isFirstSession) {
            const { error: usageErr } = await supabase
              .from('cupones_usos')
              .insert([{
                paciente_id: citaData.paciente_id,
                cita_id: data.id,
                paquete_adquirido_id: citaData.paquete_id,
                cupon_id: null
              }]);
            if (usageErr) {
              console.error('Error al registrar consumo de paquete en cupones_usos:', usageErr.message);
            }
          } else {
            // If this is Session #1, fetch and insert included procedures/trámites and package promotion historical record
            try {
              if (resolvedPaqueteCatalogoId) {
                // Fetch and insert included procedures/trámites
                const { data: catalogTramites, error: fetchTramitesErr } = await supabase
                  .from('paquetes_catalogo_tramites_incluidos')
                  .select('servicio_tramite_id, cantidad, servicios(nombre_servicio)')
                  .eq('paquete_catalogo_id', resolvedPaqueteCatalogoId);

                if (fetchTramitesErr) {
                  console.error("Error en traspaso de trámites (fetch):", fetchTramitesErr);
                }

                if (catalogTramites && catalogTramites.length > 0) {
                  const insertTramites = catalogTramites.map(t => {
                    const nombre_servicio = t.servicios
                      ? (Array.isArray(t.servicios) ? t.servicios[0]?.nombre_servicio : t.servicios.nombre_servicio)
                      : 'Trámite Incluido';

                    return {
                      paquete_adquirido_id: citaData.paquete_id,
                      servicio_tramite_id: t.servicio_tramite_id,
                      nombre_tramite_snapshot: nombre_servicio,
                      cantidad_total: t.cantidad || 1,
                      cantidad_usada: 0
                    };
                  });

                  const { error: bulkInsertErr } = await supabase
                    .from('paquetes_adquiridos_tramites_incluidos')
                    .insert(insertTramites);

                  if (bulkInsertErr) {
                    console.error("Error en traspaso de trámites (insert):", bulkInsertErr);
                  } else {
                    console.log("Trámites de paquete registrados con éxito:", insertTramites);
                  }
                }

                // If promotion was active on catalog package, record in cupones_usos
                const { data: catalogPack, error: fetchCatPackErr } = await supabase
                  .from('paquetes_catalogo')
                  .select('*')
                  .eq('id', resolvedPaqueteCatalogoId)
                  .single();

                if (fetchCatPackErr) {
                  console.error("Error en traspaso de trámites (fetch catalog pack):", fetchCatPackErr);
                }

                if (catalogPack) {
                  const todayStr = new Date().toLocaleDateString('sv-SE');
                  const datesOk = (!catalogPack.promo_fecha_inicio || todayStr >= catalogPack.promo_fecha_inicio) && 
                                  (!catalogPack.promo_fecha_fin || todayStr <= catalogPack.promo_fecha_fin);
                  const isPromoActive = catalogPack.promocion_activa && datesOk;

                  if (isPromoActive) {
                    // Check if coupon usage record was already created for this citation
                    const { data: existingUsage } = await supabase
                      .from('cupones_usos')
                      .select('id')
                      .eq('cita_id', data.id)
                      .maybeSingle();

                    if (!existingUsage) {
                      const { error: promoLogErr } = await supabase
                        .from('cupones_usos')
                        .insert([{
                          paciente_id: citaData.paciente_id,
                          cita_id: data.id,
                          paquete_adquirido_id: citaData.paquete_id,
                          cupon_id: null
                        }]);
                      if (promoLogErr) {
                        console.error("Error en traspaso de trámites (promo log error):", promoLogErr);
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Error en traspaso de trámites (catch general):", err);
            }
          }
        }
      } else if (packFetchError) {
        console.error('Error al leer crédito del paquete:', packFetchError.message);
      }
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en postCrearCita:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getCitasDelDia = async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) {
    return res.status(400).json({ success: false, error: 'La fecha es obligatoria.' });
  }

  try {
    const { data, error } = await supabase
      .from('citas')
      .select('psicologa_nombre, hora_inicio, hora_fin')
      .eq('fecha_cita', fecha)
      .neq('estado_cita', 'Cancelado');

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getCitasDelDia:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getPsicologasPorServicio = async (req, res) => {
  const { servicioId } = req.params;
  if (!servicioId) {
    return res.status(400).json({ success: false, error: 'ID de servicio es requerido.' });
  }

  try {
    const { data: psRelations, error: relError } = await supabase
      .from('psicologo_servicio')
      .select('psicologo_id')
      .eq('servicio_id', servicioId);

    if (relError) throw relError;
    if (!psRelations || psRelations.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const psicologoIds = psRelations.map(r => r.psicologo_id);

    const { data: employees, error: empError } = await supabase
      .from('empleados')
      .select('*')
      .in('id', psicologoIds)
      .eq('activo', true);

    if (empError) throw empError;

    const mappedData = employees ? employees
      .filter(emp => emp.ofrece_servicios !== false)
      .map(emp => ({
        ...emp,
        nombres_apellidos: `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
      })) : [];

    return res.json({ success: true, data: mappedData });
  } catch (error) {
    console.error('Error en getPsicologasPorServicio:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getHorariosPsicologas = async (req, res) => {
  const { psicologoId, fecha, modalidad } = req.query;
  if (!psicologoId) {
    return res.status(400).json({ success: false, error: 'ID de psicóloga es requerido.' });
  }

  try {
    let query = supabase
      .from('horarios_empleados')
      .select('*')
      .eq('empleado_id', psicologoId);

    if (fecha) {
      query = query.eq('fecha', fecha);
    }

    if (modalidad) {
      if (modalidad === 'Presencial') {
        query = query.eq('modalidad', 'Presencial');
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getHorariosPsicologas:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getCitasPsicologa = async (req, res) => {
  const { psicologoId, fecha } = req.query;
  if (!psicologoId || !fecha) {
    return res.status(400).json({ success: false, error: 'ID de psicóloga y fecha son obligatorios.' });
  }

  try {
    const { data, error } = await supabase
      .from('citas')
      .select('*')
      .eq('psicologo_id', psicologoId)
      .eq('fecha_cita', fecha)
      .neq('estado_cita', 'Cancelado');

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getCitasPsicologa:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getHabitacionesPorLocal = async (req, res) => {
  const { localId } = req.params;
  if (!localId) {
    return res.status(400).json({ success: false, error: 'ID de local es obligatorio.' });
  }

  try {
    const { data, error } = await supabase
      .from('habitaciones')
      .select('id, nombre, local_id, activo')
      .eq('local_id', localId)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error en getHabitacionesPorLocal:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export const putCancelarCita = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID de cita no proporcionado.' });
  }

  try {
    const tieneAcceso = await verificarPertenenciaCita(id, req.user.id);
    if (!tieneAcceso) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para cancelar esta cita.' });
    }

    // Select actual appointment details to verify payment status, package usage, and benefit flags
    const { data: appointment, error: fetchErr } = await supabase
      .from('citas')
      .select('estado_pago, metodo_pago, paquete_id, cupon_aplicado, promocion_aplicada')
      .eq('id', id)
      .single();

    if (fetchErr || !appointment) {
      return res.status(404).json({ success: false, error: 'Cita no encontrada.' });
    }

    const { estado_pago, metodo_pago, paquete_id, cupon_aplicado, promocion_aplicada } = appointment;

    // Strict Rule: cannot cancel if paid individually (metodo_pago !== 'Saldo de Paquete' and estado_pago === 'Pagado')
    if (estado_pago === 'Pagado' && metodo_pago !== 'Saldo de Paquete') {
      return res.status(400).json({ success: false, error: 'No es posible cancelar una cita que ya fue pagada.' });
    }

    const updates = { estado_cita: 'Cancelado', estado_pago: 'Cancelado' };

    // --- REGLA DE LIBERACIÓN DE BENEFICIOS ---
    if ((cupon_aplicado || promocion_aplicada) && estado_pago === 'Pendiente') {
      updates.cupon_aplicado = false;
      updates.promocion_aplicada = false;

      try {
        // Find if there is a coupon usage record for this citation
        const { data: usage, error: usageErr } = await supabase
          .from('cupones_usos')
          .select('cupon_id')
          .eq('cita_id', id)
          .maybeSingle();

        if (!usageErr && usage) {
          // If it was a coupon usage, decrement uses count on the coupon table
          if (usage.cupon_id) {
            const { data: coupon, error: getErr } = await supabase
              .from('cupones')
              .select('cantidad_usos_actual')
              .eq('id', usage.cupon_id)
              .maybeSingle();

            if (!getErr && coupon) {
              const newCount = Math.max(0, (coupon.cantidad_usos_actual || 0) - 1);
              await supabase
                .from('cupones')
                .update({ cantidad_usos_actual: newCount })
                .eq('id', usage.cupon_id);
            }
          }

          // Delete the usage record completely (covers both coupon and promotion usage records)
          await supabase
            .from('cupones_usos')
            .delete()
            .eq('cita_id', id);
        }
      } catch (couponCancelErr) {
        console.error('Error al liberar cupón/promoción en cancelación:', couponCancelErr.message);
      }
    }

    // --- CASE 1: Session #1 Cancellation (Aborted package acquisition) ---
    const isSessionOne = (estado_pago === 'Pendiente') && (metodo_pago === 'Pago Online' || metodo_pago === 'Pago en Clinica');
    if (paquete_id && isSessionOne) {
      const { data, error } = await supabase
        .from('citas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Delete included procedures from packages_adquiridos_tramites_incluidos
      const { error: deleteTramitesErr } = await supabase
        .from('paquetes_adquiridos_tramites_incluidos')
        .delete()
        .eq('paquete_adquirido_id', paquete_id);

      if (deleteTramitesErr) {
        console.error('Error al eliminar trámites incluidos del paquete:', deleteTramitesErr.message);
      }

      // Delete the package record completely from packages table
      const { error: deletePackErr } = await supabase
        .from('paquetes_adquiridos')
        .delete()
        .eq('id', paquete_id);

      if (deletePackErr) {
        console.error('Error al eliminar paquete adquirido tras cancelar la sesión #1:', deletePackErr.message);
      }

      return res.json({ success: true, data });
    }

    // --- CASE 2: Session #2+ Cancellation (Saldo de Paquete balance refund) ---
    else if (paquete_id && metodo_pago === 'Saldo de Paquete') {
      const { data, error } = await supabase
        .from('citas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Delete the package usage record in cupones_usos
      const { error: usageDeleteErr } = await supabase
        .from('cupones_usos')
        .delete()
        .eq('cita_id', id)
        .eq('paquete_adquirido_id', paquete_id);

      if (usageDeleteErr) {
        console.error('Error al eliminar registro de uso de paquete en cupones_usos:', usageDeleteErr.message);
      }

      // Reintegrate credit to the package (+1)
      const { data: packData, error: packFetchErr } = await supabase
        .from('paquetes_adquiridos')
        .select('sesiones_disponibles')
        .eq('id', paquete_id)
        .single();

      if (!packFetchErr && packData) {
        const newCount = (packData.sesiones_disponibles || 0) + 1;
        const { error: packUpdateErr } = await supabase
          .from('paquetes_adquiridos')
          .update({ sesiones_disponibles: newCount })
          .eq('id', paquete_id);

        if (packUpdateErr) {
          console.error('Error al reintegrar saldo del paquete:', packUpdateErr.message);
        }
      }

      return res.json({ success: true, data });
    }

    // --- CASE 3: Standard Individual Appointment Cancellation ---
    else {
      const { data, error } = await supabase
        .from('citas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ success: true, data });
    }
  } catch (error) {
    console.error('Error en putCancelarCita:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
