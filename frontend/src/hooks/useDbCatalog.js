import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CACHE_KEY = 'cepsitced_db_catalog';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook que carga todos los catálogos de base de datos con caché en localStorage.
 * Los catálogos (locales, servicios, empleados, etc.) cambian muy raramente,
 * por lo que cachearlos 5 minutos mejora drásticamente la experiencia.
 */
export const useDbCatalog = () => {
  const [dbData, setDbData] = useState(() => {
    // Try to load from cache on initialization
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          return { ...data, loading: false, error: null };
        }
      }
    } catch {}
    return {
      locales: [],
      servicios: [],
      rooms: [],
      employees: [],
      psicologoServicio: [],
      horarios: [],
      citas: [],
      reglasPrecios: [],
      asignaciones: [],
      areas: [],
      cargos: [],
      paquetesCatalogo: [],
      loading: true,
      error: null
    };
  });

  useEffect(() => {
    // If cache was valid and loaded, skip fetch
    if (!dbData.loading) return;

    const loadAllDbData = async () => {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const [
          { data: localesData, error: errLocales },
          { data: serviciosData, error: errServicios },
          { data: roomsData, error: errRooms },
          { data: employeesData, error: errEmployees },
          { data: psServData, error: errPsServ },
          { data: horariosData, error: errHorarios },
          { data: citasData, error: errCitas },
          { data: reglasPreciosData, error: errReglasPrecios },
          { data: asignacionesData, error: errAsignaciones },
          { data: areasData, error: errAreas },
          { data: cargosData, error: errCargos },
          { data: paquetesCatalogoData, error: errPaquetesCatalogo }
        ] = await Promise.all([
          supabase.from('locales').select('*').eq('activo', true),
          supabase.from('servicios').select('*').eq('activo', true),
          supabase.from('habitaciones').select('*').eq('activo', true),
          supabase.from('empleados').select('*').eq('activo', true),
          supabase.from('psicologo_servicio').select('*'),
          supabase.from('horarios_empleados').select('*').gte('fecha', tomorrowStr),
          supabase.from('citas').select('id, fecha_cita, hora_inicio, hora_fin, estado_cita, psicologo_id, habitacion_id, modalidad').gte('fecha_cita', tomorrowStr).in('estado_cita', ['Pendiente', 'Confirmado', 'Confirmada', 'Reprogramada', 'En consulta', 'En Consulta']),
          supabase.from('reglas_precios').select('*'),
          supabase.from('asignaciones_empleado').select('*'),
          supabase.from('areas').select('*').eq('activo', true),
          supabase.from('cargos').select('*'),
          supabase.from('paquetes_catalogo').select('*').eq('activo', true)
        ]);

        if (errLocales) throw errLocales;
        if (errServicios) throw errServicios;
        if (errRooms) throw errRooms;
        if (errEmployees) throw errEmployees;
        if (errPsServ) throw errPsServ;
        if (errHorarios) throw errHorarios;
        if (errCitas) throw errCitas;
        if (errReglasPrecios) throw errReglasPrecios;
        if (errAsignaciones) throw errAsignaciones;
        if (errAreas) throw errAreas;
        if (errCargos) throw errCargos;
        if (errPaquetesCatalogo) throw errPaquetesCatalogo;

        const mappedEmployees = (employeesData || []).map(emp => {
          let cargoId = emp.cargo_id || null;
          if (!cargoId && asignacionesData) {
            const empAsignaciones = asignacionesData.filter(a => a.empleado_id === emp.id);
            const asigConCargo = empAsignaciones.find(a => a.cargo_id);
            if (asigConCargo) {
              cargoId = asigConCargo.cargo_id;
            }
          }

          let prefix = '';
          if (cargoId && cargosData) {
            const cargo = cargosData.find(c => c.id === cargoId);
            if (cargo) {
              const nombreCargo = cargo.nombre || '';
              if (nombreCargo.includes('Doctor')) prefix = 'Dra. ';
              else if (nombreCargo.includes('Magister')) prefix = 'Mg. ';
              else if (nombreCargo.includes('Licenciado')) prefix = 'Lic. ';
            }
          }

          const baseName = `${emp.nombres || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim();
          return {
            ...emp,
            cargo_id: cargoId,
            nombres_apellidos: prefix ? `${prefix}${baseName}` : baseName
          };
        });

        const newData = {
          locales: localesData || [],
          servicios: serviciosData || [],
          rooms: roomsData || [],
          employees: mappedEmployees,
          psicologoServicio: psServData || [],
          horarios: horariosData || [],
          citas: citasData || [],
          reglasPrecios: reglasPreciosData || [],
          asignaciones: asignacionesData || [],
          areas: areasData || [],
          cargos: cargosData || [],
          paquetesCatalogo: paquetesCatalogoData || [],
          loading: false,
          error: null
        };

        setDbData(newData);

        // Cache static catalogs (not citas/horarios which change frequently)
        try {
          const cacheData = {
            locales: newData.locales,
            servicios: newData.servicios,
            rooms: newData.rooms,
            employees: newData.employees,
            psicologoServicio: newData.psicologoServicio,
            reglasPrecios: newData.reglasPrecios,
            asignaciones: newData.asignaciones,
            areas: newData.areas,
            cargos: newData.cargos,
            paquetesCatalogo: newData.paquetesCatalogo,
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: cacheData, timestamp: Date.now() }));
        } catch {}
      } catch (err) {
        console.error('Error preloading data:', err);
        setDbData(prev => ({ ...prev, loading: false, error: err.message }));
      }
    };

    loadAllDbData();
  }, []);

  // Method to force refresh (clear cache)
  const refreshCatalog = () => {
    localStorage.removeItem(CACHE_KEY);
    setDbData(prev => ({ ...prev, loading: true }));
  };

  return { ...dbData, refreshCatalog };
};
