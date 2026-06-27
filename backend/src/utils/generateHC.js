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
  
  // Calculate Peru local date
  const dateInPeru = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  
  // Parse birth date using regex to prevent timezone shift issues
  const match = String(fechaNacimiento).match(/^(\d{4})-(\d{2})-(\d{2})/);
  let añoNac, mesNac, diaNac;
  if (match) {
    añoNac = Number(match[1]);
    mesNac = Number(match[2]) - 1; // 0-indexed month
    diaNac = Number(match[3]);
  } else {
    const d = new Date(fechaNacimiento);
    añoNac = d.getFullYear();
    mesNac = d.getMonth();
    diaNac = d.getDate();
  }
  
  let edad = dateInPeru.getFullYear() - añoNac;
  const mesActual = dateInPeru.getMonth();
  const diaActual = dateInPeru.getDate();
  
  if (mesActual < mesNac || (mesActual === mesNac && diaActual < diaNac)) {
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
  
  // Get date in Peru (America/Lima)
  const dateInPeru = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const dia = String(dateInPeru.getDate()).padStart(2, '0');
  const mes = String(dateInPeru.getMonth() + 1).padStart(2, '0');
  const anio = String(dateInPeru.getFullYear()).slice(-2);
  const fechaHoyStr = `${dia}${mes}${anio}`; // DDMMAA
  
  // Search pattern is XXXXDDMMAAL where DDMMAAL is date + suffix
  const patternSearch = `%${fechaHoyStr}${sufijo}`;
  
  // Query the highest HC number ending in the calculated DDMMAAL pattern
  const { data, error } = await supabase
    .from('pacientes')
    .select('numero_hc')
    .like('numero_hc', patternSearch)
    .order('numero_hc', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  let ultimoHC = data?.numero_hc || null;

  // If we already generated HCs with this suffix and date in the current request, find the highest one
  for (const hc of alreadyGenerated) {
    if (hc.endsWith(`${fechaHoyStr}${sufijo}`)) {
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

  const secuencialStr = String(secuencial).padStart(4, '0');

  return `${secuencialStr}${fechaHoyStr}${sufijo}`;
};
