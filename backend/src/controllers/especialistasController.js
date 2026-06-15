import { supabase } from '../config/supabase.js';
import { formatFullName } from '../utils/formatters.js';

const fallbackNamesMap = {
  '0f7d4b9e-b74f-4d66-a052-4773fbb8c6ca': 'Dra. Milagros Silvia Ordinola Villegas',
  '86bacf53-dd77-4899-bf11-f6f7b3cbf940': 'Lic. Karina Isabel Castillo Aguila',
  '17946652-05c2-4d7c-9d8b-37dd2147eba2': 'Mg. Williams Antonio De La Cruz Polo',
  'c4c6e1f8-a03b-457f-afb3-4546be2ec895': 'Lic. Julia Jhasmin Pillaca Solis'
};

export const getEspecialistasLanding = async (req, res) => {
  try {
    // 1. Fetch active personal configs
    const { data: personalList, error: personalErr } = await supabase
      .from('landing_personal')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (personalErr) throw personalErr;
    if (!personalList || personalList.length === 0) {
      return res.json([]);
    }

    // Get employee IDs
    const empIds = personalList.map(p => p.empleado_id);

    // 2. Fetch employees (safely, since RLS might return empty anonymously)
    let emps = [];
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .in('id', empIds);
      if (!error && data) emps = data;
    } catch (e) {
      console.warn('Could not fetch employees:', e.message);
    }

    // 3. Fetch assignments (safely)
    let assignments = [];
    try {
      const { data, error } = await supabase
        .from('asignaciones_empleado')
        .select('*')
        .in('empleado_id', empIds);
      if (!error && data) assignments = data;
    } catch (e) {
      console.warn('Could not fetch assignments:', e.message);
    }

    // 4. Fetch cargos (safely)
    let cargos = [];
    try {
      const { data, error } = await supabase
        .from('cargos')
        .select('*')
        .eq('activo', true);
      if (!error && data) cargos = data;
    } catch (e) {
      console.warn('Could not fetch cargos:', e.message);
    }

    // 5. Fetch areas (safely)
    let areas = [];
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('activo', true);
      if (!error && data) areas = data;
    } catch (e) {
      console.warn('Could not fetch areas:', e.message);
    }

    // Map helpers
    const empMap = new Map(emps.map(e => [e.id, e]));
    const assignMap = new Map(assignments.map(a => [a.empleado_id, a]));
    const cargoMap = new Map(cargos.map(c => [c.id, c.nombre]));
    const areaMap = new Map(areas.map(a => [a.id, a.nombre]));

    const specialists = [];

    for (const p of personalList) {
      const emp = empMap.get(p.empleado_id);

      const assign = assignMap.get(p.empleado_id);
      const cargoName = assign ? cargoMap.get(assign.cargo_id) : null;
      const areaName = assign ? areaMap.get(assign.area_id) : null;

      // Construct studies list from formacion_1..4
      const estudios = [p.formacion_1, p.formacion_2, p.formacion_3, p.formacion_4]
        .map(f => f ? String(f).trim() : '')
        .filter(Boolean);

      // Fallback name if employee is hidden under RLS
      let fullName = 'Especialista Clínico';
      if (emp) {
        fullName = formatFullName(emp.nombres, emp.apellido_paterno, emp.apellido_materno);
      } else if (fallbackNamesMap[p.empleado_id]) {
        fullName = fallbackNamesMap[p.empleado_id];
      }

      const cpspText = p.nro_cpsp ? (String(p.nro_cpsp).toLowerCase().includes('c.ps.p') ? p.nro_cpsp : `C.Ps.P. ${p.nro_cpsp}`) : '';

      let specialtyText = 'Psicólogo(a)';
      if (cargoName) {
        specialtyText = areaName ? `${cargoName} - ${areaName}` : cargoName;
      } else if (emp && emp.rol_sistema) {
        specialtyText = emp.rol_sistema;
      }

      specialists.push({
        id: p.id,
        empleado_id: p.empleado_id,
        nombreCompleto: fullName,
        nombre: fullName, // Legacy
        cargo: cargoName || 'Psicólogo(a)',
        area: areaName || '',
        especialidad: specialtyText, // Legacy
        nroCpsp: cpspText,
        colegiatura: cpspText || 'C.Ps.P. Disponible', // Legacy
        horario: p.horario || 'Horarios a consultar. Modalidad Presencial y Virtual.',
        atencion: p.horario || 'Horarios a consultar. Modalidad Presencial y Virtual.', // Legacy
        modalidad: p.modalidad || 'Presencial y Virtual',
        imagenPerfilUrl: p.imagen_perfil_url || '',
        foto: p.imagen_perfil_url || null, // Legacy
        perfilProfesional: p.perfil_profesional || 'Especialista en psicología con enfoque integral.',
        descripcion: p.perfil_profesional || 'Especialista en psicología con enfoque integral.', // Legacy
        formaciones: estudios.length > 0 ? estudios : ['Licenciatura en Psicología'],
        estudios: estudios.length > 0 ? estudios : ['Licenciatura en Psicología'], // Legacy
        activo: p.activo !== undefined ? p.activo : true
      });
    }

    return res.json(specialists);
  } catch (err) {
    console.error('Error en getEspecialistasLanding:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
