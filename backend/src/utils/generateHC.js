/**
 * Utility for generating category-specific Historia Clínica numbers on the backend.
 */

/**
 * Calculates the gender and age suffix (M, F, m, f).
 * @param {string|Date} fechaNacimiento 
 * @param {string} genero 
 * @returns {string}
 */
export const calcularSufijoHC = (fechaNacimiento, genero) => {
  if (!fechaNacimiento || !genero) return '';
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNac = fechaNac.getMonth();
  
  if (mesActual < mesNac || (mesActual === mesNac && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  
  const esMayor = edad >= 18;
  const esMasculino = String(genero).trim().toLowerCase().startsWith('m');
  
  if (esMasculino) {
    return esMayor ? 'M' : 'm';
  } else {
    return esMayor ? 'F' : 'f';
  }
};

/**
 * Generates the next sequential HC number for a given birthdate and gender.
 * @param {object} supabase - Supabase client
 * @param {string|Date} fechaNacimiento 
 * @param {string} genero 
 * @param {string[]} alreadyGenerated - Local list of HCs generated in the current transaction/request
 * @returns {Promise<string>}
 */
export const generarSiguienteHC = async (supabase, fechaNacimiento, genero, alreadyGenerated = []) => {
  const sufijo = calcularSufijoHC(fechaNacimiento, genero);
  
  // Query the highest HC number ending in the calculated suffix
  const { data, error } = await supabase
    .from('pacientes')
    .select('numero_hc')
    .like('numero_hc', `%${sufijo}`)
    .order('numero_hc', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  let ultimoHC = data?.numero_hc || null;

  // If we already generated HCs with this suffix in the current request, find the highest one
  for (const hc of alreadyGenerated) {
    if (hc.endsWith(sufijo)) {
      if (!ultimoHC || hc > ultimoHC) {
        ultimoHC = hc;
      }
    }
  }

  let secuencial = 1;
  if (ultimoHC) {
    const secStr = ultimoHC.substring(0, 4);
    const secNum = parseInt(secStr, 10);
    if (!isNaN(secNum)) {
      secuencial = secNum + 1;
    }
  }

  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, '0');
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const anio = String(hoy.getFullYear()).slice(-2);
  const secuencialStr = String(secuencial).padStart(4, '0');

  return `${secuencialStr}${dia}${mes}${anio}${sufijo}`;
};
